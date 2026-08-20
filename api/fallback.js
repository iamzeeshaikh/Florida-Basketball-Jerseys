// Catch-all for paths the static output does not contain.
//
// WordPress on this host answered mixed-case URLs with the page itself (200,
// no redirect) -- /About/, /ABOUT/ and /product/Blank-Basketball-Jerseys/ all
// render. A static host is case-sensitive, so the lower-cased path is looked up
// here and its HTML returned with the same 200. Anything else gets the site's
// own 404 template with a 404 status, exactly as before.
import pages from '../src/data/pages.json' with { type: 'json' };

const ROUTES = new Set(Object.values(pages).map((p) => p.route));

function origin(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'https://placeholder.invalid');
  let pathname = url.pathname;
  if (!pathname.endsWith('/') && !pathname.includes('.')) pathname += '/';
  const lower = pathname.toLowerCase();

  if (lower !== pathname && ROUTES.has(lower)) {
    const r = await fetch(origin(req) + lower, { headers: { 'user-agent': req.headers['user-agent'] || '' } });
    const body = await r.text();
    res.statusCode = 200;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    return res.end(body);
  }

  const r = await fetch(origin(req) + '/404.html');
  const body = await r.text();
  res.statusCode = 404;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  return res.end(body);
}
