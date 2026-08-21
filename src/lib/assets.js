// A build stamp for everything under public/assets.
//
// Those files are served with a one-year `immutable` cache header, so a plain
// /assets/fbj.js URL means an updated script never reaches a browser -- or a
// CDN -- that already holds the old one. Stamping the URL with a hash of the
// files' contents makes every change a new URL, and leaves the long cache
// working in our favour.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// this module is bundled before it runs, so import.meta.url points into the
// build output; the build always runs from the project root
const DIR = path.join(process.cwd(), 'public', 'assets');
const FILES = ['fbj.js', 'cart.js', 'catalogue.json', 'cart-templates.json', 'loops.json'];

const hash = createHash('sha256');
for (const f of FILES) hash.update(readFileSync(path.join(DIR, f)));
export const ASSET_VERSION = hash.digest('hex').slice(0, 10);
