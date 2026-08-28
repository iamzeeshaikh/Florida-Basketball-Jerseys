// Quote requests: /get-a-quote/ and the "Instant Quote" form on every product
// page. Both used to be handled inside WordPress -- the first by a custom REST
// route registered in a Code Snippet, the second by Elementor Pro. The fields,
// labels, validation and messages are unchanged; only the delivery moves here.
//
// Every product enquiry carries the product name and the page it came from, so
// the recipient always knows which jersey is being asked about.
import { parseMultipart, transport, fromHeader, recipients, isEmail, render } from './_mail.js';

export const config = { api: { bodyParser: false } };

// Elementor gives unlabelled fields generated ids; this form's map, read off
// the WordPress form definition.
const ELEMENTOR_LABELS = {
  'form_fields[name]': 'Name',
  'form_fields[email]': 'Email',
  'form_fields[field_f54cfcb]': 'Phone',
  'form_fields[field_a858f27]': 'Product',
  'form_fields[message]': 'Message',
};
const HONEYPOT = 'form_fields[field_228829a]';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'An error occurred.' });
  }

  let parsed;
  try {
    parsed = await parseMultipart(req);
  } catch {
    return res.status(400).json({ success: false, message: 'An error occurred.' });
  }
  const { fields, files } = parsed;
  const pageUrl = fields.page_url || '';

  // Elementor's honeypot: accept silently so a bot gets no signal
  if (fields[HONEYPOT]) return res.status(200).json({ success: true, message: 'The form was sent successfully.' });

  const isElementor = Object.keys(fields).some((k) => k.startsWith('form_fields['));
  let subject, rows, replyTo, name, email;

  if (isElementor) {
    name = fields['form_fields[name]'] || '';
    email = fields['form_fields[email]'] || '';
    const phone = fields['form_fields[field_f54cfcb]'] || '';
    if (!isEmail(email) || !phone) {
      return res.status(400).json({ success: false, message: 'This field is required.' });
    }
    // referer_title is the product page's own <title>; the product name is the
    // part before the brand suffix
    const referer = fields.referer_title || '';
    const product = fields['form_fields[field_a858f27]'] ||
      referer.replace(/\s*\|.*$/, '').replace(/^Custom\s+/, '').replace(/\s+Florida$/, '');
    subject = `New message from "Florida Basketball Jerseys"`;
    rows = [
      ['Product', product],
      ['Name', name],
      ['Email', email],
      ['Phone', phone],
      ['Message', fields['form_fields[message]'] || ''],
      ['Page', pageUrl || referer],
      ['Product ID', fields.queried_id || ''],
      ['Form', 'Instant Quote'],
    ];
    replyTo = isEmail(email) ? `${name || email} <${email}>` : undefined;
  } else {
    name = fields.name || '';
    email = fields.email || '';
    const jerseyType = fields.jersey_type || '';
    const quantity = fields.quantity || '';
    const message = fields.message || '';
    if (!name || !email || !jerseyType || !quantity || !message) {
      return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
    }
    if (!isEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }
    const yn = (k) => (fields[k] ? 'Yes' : 'No');
    subject = 'New Quote Request - Florida Basketball Jerseys';
    rows = [
      ['Full Name', name],
      ['Email', email],
      ['Phone', fields.phone || ''],
      ['Team / Organization', fields.team || ''],
      ['Jersey Type', jerseyType],
      ['Quantity', quantity],
      ['Sizes', fields.sizes || ''],
      ['Deadline', fields.deadline || ''],
      ['Custom Design', yn('need_design')],
      ['Player Names', yn('need_names')],
      ['Player Numbers', yn('need_numbers')],
      ['Team Logo', yn('need_logo')],
      ['Matching Shorts', yn('need_shorts')],
      ['Youth Sizes', yn('need_youth')],
      ['Project Details', message],
      ['Page', pageUrl || 'https://floridabasketballjerseys.com/get-a-quote/'],
      ['Form', 'Get a Quote'],
    ];
    replyTo = `${name} <${email}>`;
  }

  try {
    await transport().sendMail({
      from: fromHeader(),
      to: recipients('QUOTE_TO'),
      replyTo,
      subject,
      ...render(subject, rows),
      attachments: files.map((f) => ({ filename: f.filename, content: f.content, contentType: f.contentType })),
    });
  } catch (err) {
    console.error('quote mail failed:', err && err.message);
    return res.status(500).json({ success: false, message: 'Email could not be sent.' });
  }
  return res.status(200).json({ success: true, message: 'Quote request sent successfully.' });
}
