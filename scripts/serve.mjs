// Local QA server: serves dist/ the way the production host will (directory
// index, trailing slash, redirects, the case-insensitive fallback) and runs the
// api/ handlers with a Vercel-shaped req/res so the forms can be tested end to
// end before deployment.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, process.env.DIST_DIR || 'dist');
const PORT = Number(process.env.PORT || 4321);
const redirects = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/redirects.json'), 'utf8'));

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject', '.xml': 'application/xml',
  '.txt': 'text/plain', '.pdf': 'application/pdf',
};

// Cloudflare rewrites mailto links at its edge and decodes them with a script it
// also injects. Replaying a captured page locally skips that step, so decode
// here to match what a visitor to the live site actually sees.
function cfDecode(html) {
  const dec = (hex) => {
    const b = Buffer.from(hex, 'hex');
    let s = '';
    for (let i = 1; i < b.length; i++) s += String.fromCharCode(b[i] ^ b[0]);
    return s;
  };
  return html
    .replace(/href="\/cdn-cgi\/l\/email-protection#([0-9a-f]+)"/g, (_, h) => `href="mailto:${dec(h)}"`)
    .replace(/<span[^>]*class="__cf_email__"[^>]*data-cfemail="([0-9a-f]+)"[^>]*>[\s\S]*?<\/span>/g, (_, h) => dec(h))
    .replace(/<a[^>]*class="__cf_email__"[^>]*data-cfemail="([0-9a-f]+)"[^>]*>[\s\S]*?<\/a>/g, (_, h) => dec(h))
    .replace(/<script[^>]*\/cdn-cgi\/scripts\/[^>]*email-decode[^>]*><\/script>/g, '');
}

function vercelRes(res) {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(o));
    return res;
  };
  return res;
}

function serveFile(res, file, status = 200) {
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      return res.end('<h1>404</h1>');
    }
    res.writeHead(status, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);

  const apiRoute = pathname.replace(/\/$/, '');
  if (apiRoute.startsWith('/api/')) {
    try {
      const { default: handler } = await import('../api' + apiRoute.slice(4) + '.js');
      return handler(req, vercelRes(res));
    } catch (e) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end('no api handler: ' + apiRoute + ' ' + e.message);
    }
  }

  // /__live/<route> replays the captured live HTML with its absolute URLs
  // repointed here, so the original page renders against the same local copies
  // of the assets. Used for the side-by-side visual comparison.
  if (pathname.startsWith('/__live/')) {
    const route = pathname.slice('/__live'.length);
    const slug = route === '/' ? '__home' : route.replace(/^\/|\/$/g, '').replace(/\//g, '__');
    // /checkout/, /search/ and the 404 template were captured separately
    const alias = { checkout: 'checkout', search: 'search', '404': '404' };
    const dir = alias[slug] ? 'crawl-extra' : 'crawl';
    const file = path.join(ROOT, 'scripts', dir, slug + '.html');
    let html;
    try { html = fs.readFileSync(file, 'utf8'); } catch {
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      return res.end('<h1>404 no capture for ' + slug + '</h1>');
    }
    html = cfDecode(html).split('https://floridabasketballjerseys.com').join('http://localhost:' + PORT);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  // WordPress served /?s=term as the product search results page
  if (pathname === '/' && url.searchParams.has('s')) pathname = '/search/';

  const redirect = redirects.redirects.find((r) => r.source === pathname);
  if (redirect) {
    res.writeHead(redirect.statusCode, { location: redirect.destination });
    return res.end();
  }

  const rw = redirects.rewrites.find((r) => r.source === pathname);
  if (rw) pathname = rw.destination;

  // trailing slash, as vercel.json trailingSlash: true
  if (!path.extname(pathname) && !pathname.endsWith('/')) {
    res.writeHead(308, { location: pathname + '/' + url.search });
    return res.end();
  }

  let file = path.join(DIST, pathname);
  if (!path.extname(file)) file = path.join(file, 'index.html');
  if (fs.existsSync(file)) return serveFile(res, file);

  // the case-insensitive alias + 404 fallback the production host runs
  const lower = path.join(DIST, pathname.toLowerCase());
  const lowerFile = path.extname(lower) ? lower : path.join(lower, 'index.html');
  if (fs.existsSync(lowerFile)) return serveFile(res, lowerFile);
  return serveFile(res, path.join(DIST, '404.html'), 404);
});

server.listen(PORT, () => console.log('QA server on http://localhost:' + PORT));
