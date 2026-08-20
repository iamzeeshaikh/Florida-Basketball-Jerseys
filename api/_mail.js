// Shared transport + multipart parsing for the site's two form endpoints.
import Busboy from 'busboy';
import nodemailer from 'nodemailer';

export const MAX_FILE_BYTES = 8 * 1024 * 1024;

export function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers, limits: { fileSize: MAX_FILE_BYTES, files: 5 } });
    const fields = {};
    const files = [];
    bb.on('field', (name, value) => {
      const key = name.replace(/\[\]$/, '');
      if (key in fields) fields[key] = [].concat(fields[key], value);
      else fields[key] = value;
    });
    bb.on('file', (name, stream, info) => {
      const chunks = [];
      let truncated = false;
      stream.on('data', (c) => chunks.push(c));
      stream.on('limit', () => { truncated = true; });
      stream.on('end', () => {
        const content = Buffer.concat(chunks);
        if (content.length && !truncated) {
          files.push({ filename: info.filename, contentType: info.mimeType, content });
        }
      });
    });
    bb.on('error', reject);
    bb.on('close', () => resolve({ fields, files }));
    req.pipe(bb);
  });
}

export function transport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE) === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

export function fromHeader() {
  const name = process.env.MAIL_FROM_NAME || 'Florida Basktetball Jerseys';
  const email = process.env.MAIL_FROM_EMAIL || 'info@floridabasketballjerseys.com';
  return `"${name}" <${email}>`;
}

export function recipients(envKey, fallback) {
  return (process.env[envKey] || fallback).split(',').map((s) => s.trim()).filter(Boolean);
}

export function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
}

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Plain-text + HTML body from an ordered list of [label, value] pairs. */
export function render(title, rows) {
  const kept = rows.filter(([, v]) => v !== '' && v != null);
  const text = `${title}\n\n` + kept.map(([k, v]) => `${k}: ${v}`).join('\n') + '\n';
  const html =
    `<h2 style="font-family:Arial,sans-serif">${esc(title)}</h2>` +
    '<table style="font-family:Arial,sans-serif;border-collapse:collapse">' +
    kept.map(([k, v]) =>
      `<tr><td style="padding:4px 12px 4px 0;vertical-align:top"><strong>${esc(k)}</strong></td>` +
      `<td style="padding:4px 0;vertical-align:top">${esc(v).replace(/\n/g, '<br>')}</td></tr>`).join('') +
    '</table>';
  return { text, html };
}
