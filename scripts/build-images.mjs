/*
 * Generate a .webp beside every raster in public/, and report what it saves.
 *
 * WebP is written ALONGSIDE the original rather than replacing it, so the
 * markup can offer it through <picture> with the original as the fallback and
 * nothing breaks if a browser or a plugin wants the jpg.
 *
 * Quality 82 for photographs and lossless for images with transparency —
 * a logo re-encoded lossily picks up ringing around the edges of flat colour,
 * which is exactly where it is most visible.
 *
 * Run after adding images; it skips anything already converted and up to date.
 *
 * `--clean` re-encodes everything, and it deletes ONLY the .webp files this
 * script could regenerate — the ones with a .jpg or .png sibling. Twelve WebP
 * files on this site are originals with no raster source (the WooCommerce
 * placeholder set and a guarantee badge), and a blanket `find -name '*.webp'
 * -delete` removes them permanently. It did, once; they came back from git.
 * A cleaner that cannot tell its own output from somebody else's input is a
 * cleaner that eventually deletes the wrong thing.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'public';
const RASTER = /\.(jpe?g|png)$/i;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (RASTER.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk(ROOT);

if (process.argv.includes('--clean')) {
  let removed = 0;
  for (const src of files) {
    const out = src.replace(RASTER, '.webp');
    if (fs.existsSync(out)) { fs.unlinkSync(out); removed++; }
  }
  console.log(`--clean: removed ${removed} generated .webp files (originals without a raster source were left alone)`);
}

let made = 0, skipped = 0, before = 0, after = 0, failed = 0;

for (const src of files) {
  const out = src.replace(RASTER, '.webp');
  const srcStat = fs.statSync(src);

  if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= srcStat.mtimeMs) {
    skipped++;
    before += srcStat.size;
    after += fs.statSync(out).size;
    continue;
  }

  // PNG is the awkward case. It holds logos and badges, where a lossy encode
  // rings visibly around hard edges of flat colour — and it also holds
  // photographs somebody saved in the wrong format, where lossless is
  // enormous. Assuming lossless for every PNG made a payment badge the single
  // largest image on a product page at 47KB.
  //
  // So encode BOTH and keep the smaller. Lossy carries -alpha_q 100 so
  // transparency stays exact even when the colour data does not, and q=90 is
  // high enough that flat colour survives it.
  const png = /\.png$/i.test(src);

  try {
    if (png) {
      const a = out + '.lossless';
      const b = out + '.lossy';
      execFileSync('cwebp', ['-lossless', '-q', '100', '-quiet', src, '-o', a], { stdio: 'pipe' });
      execFileSync('cwebp', ['-q', '90', '-alpha_q', '100', '-m', '5', '-quiet', src, '-o', b], { stdio: 'pipe' });
      const keep = fs.statSync(a).size <= fs.statSync(b).size ? a : b;
      const drop = keep === a ? b : a;
      fs.renameSync(keep, out);
      fs.unlinkSync(drop);
    } else {
      execFileSync('cwebp', ['-q', '82', '-m', '5', '-quiet', src, '-o', out], { stdio: 'pipe' });
    }
    made++;
    before += srcStat.size;
    after += fs.statSync(out).size;
  } catch {
    failed++;
  }
}

const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
console.log(`${files.length} rasters: ${made} converted, ${skipped} already current, ${failed} failed`);
console.log(`originals ${mb(before)} -> webp ${mb(after)}  (${Math.round((1 - after / before) * 100)}% smaller)`);
