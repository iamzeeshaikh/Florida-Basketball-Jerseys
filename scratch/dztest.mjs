/* Does the designer still work after being moved into a component? Clicking a
 * swatch must repaint the SVG, not just mark a chip active. */
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
await p.goto(process.argv[2], { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(1200);
const before = await p.evaluate(() => ({
  swatches: document.querySelectorAll('.fbj-dz-sw, [data-opt] button, .fbj-dz-chip').length,
  canvas: !!document.querySelector('[data-canvas]'),
  baseFill: document.querySelector('[data-fill="base"]')?.getAttribute('fill'),
  spec: document.querySelector('[data-spec-view]')?.textContent.trim().slice(0, 60),
  form: !!document.querySelector('[data-dz-form]'),
}));
console.log('initial:', JSON.stringify(before));
const after = await p.evaluate(async () => {
  const sw = [...document.querySelectorAll('[data-opt="base"] button, .fbj-dz-sw')];
  const chips = [...document.querySelectorAll('[data-opt="panel"] button')];
  if (sw[4]) sw[4].click();
  if (chips[2]) chips[2].click();
  const inp = document.querySelector('[data-in="team"]');
  if (inp) { inp.value = 'LIONS'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
  await new Promise((r) => setTimeout(r, 350));
  return {
    baseFill: document.querySelector('[data-fill="base"]')?.getAttribute('fill'),
    teamText: document.querySelector('[data-jersey-text="team"]')?.textContent,
    panelShown: [...document.querySelectorAll('[data-panel]')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.dataset.panel),
    spec: document.querySelector('[data-spec-view]')?.textContent.trim().slice(0, 70),
  };
});
console.log('after clicks:', JSON.stringify(after));
console.log('errors:', errs.length ? errs : 'none');
await b.close();
