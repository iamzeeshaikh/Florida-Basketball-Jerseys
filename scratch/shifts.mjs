/* Every layout shift, with enough about the moving node to act on it. */
import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (4*1024*1024)/8, uploadThroughput: (1024*1024)/8 });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await page.addInitScript(() => {
  window.__s = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      if (e.hadRecentInput || e.value < 0.004) continue;
      window.__s.push({
        v: +e.value.toFixed(3), t: Math.round(e.startTime),
        nodes: (e.sources || []).slice(0, 3).map((s) => {
          const n = s.node;
          if (!n || !n.getBoundingClientRect) return '?';
          const path = [];
          let el = n;
          for (let i = 0; i < 3 && el && el.tagName; i++, el = el.parentElement)
            path.push(el.tagName + (el.className ? '.' + el.className.toString().trim().split(/\s+/)[0] : ''));
          return {
            path: path.join(' < '),
            from: `${Math.round(s.previousRect.top)},${Math.round(s.previousRect.height)}`,
            to: `${Math.round(s.currentRect.top)},${Math.round(s.currentRect.height)}`,
            text: (n.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 46),
            id: n.id || (n.parentElement && n.parentElement.id) || '',
            dataId: n.getAttribute && (n.getAttribute('data-id') || (n.parentElement && n.parentElement.getAttribute('data-id'))) || '',
            widget: n.querySelector && (n.querySelector('[data-widget_type]') || {}).getAttribute
              ? n.querySelector('[data-widget_type]').getAttribute('data-widget_type') : '',
            html: (n.outerHTML || '').replace(/\s+/g, ' ').slice(0, 220),
          };
        }),
      });
    }
  }).observe({ type: 'layout-shift', buffered: true });
});
await page.goto(process.argv[2], { waitUntil: 'load', timeout: 60000 }).catch(()=>{});
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(3500);
const s = await page.evaluate(() => window.__s);
console.log('total CLS', s.reduce((a, x) => a + x.v, 0).toFixed(3));
for (const x of s) { console.log(`\n${x.v}  @${x.t}ms`); for (const n of x.nodes) console.log('   ', JSON.stringify(n)); }
await b.close();
