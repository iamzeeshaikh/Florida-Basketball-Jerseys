// The /contact/ form. On WordPress this form never delivered anything -- its
// handler only hid the form and revealed the success panel (the source comment
// said "replace with actual form POST"). The markup, labels, validation and
// success panel are unchanged; the submission is now actually delivered.
import { parseMultipart, transport, fromHeader, recipients, isEmail, render } from './_mail.js';

export const config = { api: { bodyParser: false } };

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

  const name = fields.name || '';
  const email = fields.email || '';
  const program = fields.program || '';
  const message = fields.message || '';
  if (!name || !email || !program || !message) {
    return res.status(400).json({
      success: false,
      message: 'Please fill in all required fields (Name, Email, Program Type, and Message).',
    });
  }
  if (!isEmail(email)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
  }

  const yn = (k) => (fields[k] ? 'Yes' : 'No');
  const subject = 'New Contact Message - Florida Basketball Jerseys';
  const rows = [
    ['Full Name', name],
    ['Email', email],
    ['Phone', fields.phone || ''],
    ['City', fields.city || ''],
    ['Program Type', program],
    ['Jersey Type', fields.jersey_type || ''],
    ['Quantity', fields.quantity || ''],
    ['Custom Design', yn('need_design')],
    ['Player Names', yn('need_names')],
    ['Player Numbers', yn('need_numbers')],
    ['Team Logo', yn('need_logo')],
    ['Matching Shorts', yn('need_shorts')],
    ['Youth Sizes', yn('need_youth')],
    ['Deadline', fields.deadline || ''],
    ['Message', message],
    ['Page', fields.page_url || 'https://floridabasketballjerseys.com/contact/'],
    ['Form', 'Contact'],
  ];

  try {
    await transport().sendMail({
      from: fromHeader(),
      to: recipients('CONTACT_TO'),
      replyTo: `${name} <${email}>`,
      subject,
      ...render(subject, rows),
      attachments: files.map((f) => ({ filename: f.filename, content: f.content, contentType: f.contentType })),
    });
  } catch (err) {
    console.error('contact mail failed:', err && err.message);
    return res.status(500).json({ success: false, message: 'Email could not be sent.' });
  }
  return res.status(200).json({ success: true, message: 'Message sent successfully.' });
}
