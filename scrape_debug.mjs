import { chromium } from 'playwright';
import fs from 'fs';

const CATALOG_URL = 'https://reg.snowflake.com/flow/snowflake/summit26/sessions/page/catalog?tab.sessioncatalogtab=1714168666431001NNiH';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });

  // Intercept network requests to find the API
  const apiRequests = [];
  page.on('request', req => {
    const url = req.url();
    if (url.includes('session') || url.includes('catalog') || url.includes('search') || url.includes('items') || url.includes('api') || url.includes('graphql')) {
      if (!url.includes('.js') && !url.includes('.css') && !url.includes('.png') && !url.includes('.svg')) {
        apiRequests.push({ method: req.method(), url: url.substring(0, 200) });
      }
    }
  });

  const apiResponses = [];
  page.on('response', async res => {
    const url = res.url();
    if ((url.includes('session') || url.includes('catalog') || url.includes('search') || url.includes('items') || url.includes('api') || url.includes('rf')) && !url.includes('.js') && !url.includes('.css') && !url.includes('.png')) {
      try {
        const body = await res.text();
        apiResponses.push({ url: url.substring(0, 200), status: res.status(), bodyLen: body.length, bodyPreview: body.substring(0, 300) });
      } catch (e) {}
    }
  });

  console.log('Loading catalog...');
  await page.goto(CATALOG_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(8000);

  console.log(`\n=== API Requests (${apiRequests.length}) ===`);
  apiRequests.forEach(r => console.log(`  ${r.method} ${r.url}`));

  console.log(`\n=== API Responses (${apiResponses.length}) ===`);
  apiResponses.forEach(r => console.log(`  [${r.status}] ${r.url} (${r.bodyLen} bytes)\n    ${r.bodyPreview.substring(0, 150)}`));

  // Look for "Load More", "Show More", pagination buttons, or "next" links
  const loadMoreElements = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('button, a, [role="button"]').forEach(el => {
      const text = (el.textContent || '').trim().toLowerCase();
      if (text.includes('load more') || text.includes('show more') || text.includes('next') ||
          text.includes('view more') || text.includes('see all') || text.includes('more sessions')) {
        results.push({
          tag: el.tagName,
          text: (el.textContent || '').trim().substring(0, 80),
          class: (el.className || '').substring(0, 60)
        });
      }
    });
    return results;
  });
  console.log('\n=== Load More / Pagination elements ===');
  loadMoreElements.forEach(e => console.log(`  ${e.tag}: "${e.text}" class="${e.class}"`));

  // Check for any "Showing X of Y" type text
  const bodyText = await page.evaluate(() => document.body.innerText);
  const showingLines = bodyText.split('\n').filter(l => 
    l.match(/showing|of\s+\d+|page\s+\d+|result/i) && l.trim().length < 100
  );
  console.log('\n=== Showing/Results text ===');
  showingLines.forEach(l => console.log(`  "${l.trim()}"`));

  // Check for any infinite scroll sentinel elements
  const sentinels = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('[class*="sentinel"], [class*="infinite"], [class*="loader"], [class*="loading"], [class*="spinner"]').forEach(el => {
      results.push({
        tag: el.tagName,
        class: el.className.substring(0, 80),
        visible: el.offsetHeight > 0
      });
    });
    return results;
  });
  console.log('\n=== Scroll sentinels / loaders ===');
  sentinels.forEach(s => console.log(`  ${s.tag} class="${s.class}" visible=${s.visible}`));

  // Count session cards
  const cardCount = await page.evaluate(() => {
    // Try various card selector patterns
    const patterns = [
      '[class*="session"]',
      '[class*="card"]',
      '[class*="item"]',
      '[class*="result"]',
      'article',
      '[data-item]',
      '[data-session]',
    ];
    const counts = {};
    patterns.forEach(p => {
      try { counts[p] = document.querySelectorAll(p).length; } catch(e) {}
    });
    return counts;
  });
  console.log('\n=== Element counts by selector ===');
  Object.entries(cardCount).forEach(([k, v]) => {
    if (v > 0) console.log(`  ${k}: ${v}`);
  });

  await browser.close();
})();
