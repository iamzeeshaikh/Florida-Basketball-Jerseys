/* Core Web Vitals on a throttled mobile connection.
 *
 * LCP and CLS from the browser's own PerformanceObserver rather than from a
 * proxy metric, and transfer size counted from the network rather than from
 * file sizes on disk -- a page that ships 200KB of CSS the browser caches
 * after the first page is not the same as one that ships it every time.
 *
 * CPU and network are throttled to something like a mid-range phone on 4G,
 * because an unthrottled desktop measurement of LCP tells you almost nothing
 * about the device most of these visitors are on.
 */
import { chromium } from 'playwright';

const ROUTES = process.argv.slice(2);
const b = await chromium.launch();

console.log('route'.padEnd(42), 'LCP'.padStart(8), 'CLS'.padStart(7), 'transfer'.padStart(10), 'reqs'.padStart(6));
for (const r of ROUTES) {
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 150, downloadThroughput: (4 * 1024 * 1024) / 8, uploadThroughput: (1024 * 1024) / 8,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  let bytes = 0, reqs = 0;
  page.on('response', async (res) => {
    reqs++;
    const len = res.headers()['content-length'];
    if (len) bytes += Number(len);
    else { try { bytes += (await res.body()).length; } catch {} }
  });

  await page.addInitScript(() => {
    window.__lcp = 0; window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; })
      .observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });

  await page.goto(`http://localhost:4471${r}`, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2500);
  const v = await page.evaluate(() => ({ lcp: window.__lcp, cls: window.__cls }));
  console.log(
    r.padEnd(42),
    `${(v.lcp / 1000).toFixed(2)}s`.padStart(8),
    v.cls.toFixed(3).padStart(7),
    `${(bytes / 1024).toFixed(0)}KB`.padStart(10),
    String(reqs).padStart(6));
  await ctx.close();
}
await b.close();
