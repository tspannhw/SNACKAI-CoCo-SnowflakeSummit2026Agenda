import { chromium } from 'playwright';
import fs from 'fs';

const CATALOG_URL = 'https://reg.snowflake.com/flow/snowflake/summit26/sessions/page/catalog?tab.sessioncatalogtab=1714168666431001NNiH';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Opening catalog...');
  await page.goto(CATALOG_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000);

  // Check what day navigation exists
  const bodyText = await page.evaluate(() => document.body.innerText);
  const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Look for day-related UI elements
  console.log('\n=== Lines containing day/date/june keywords ===');
  lines.forEach((l, i) => {
    if (l.match(/monday|tuesday|wednesday|thursday|jun|day\s/i) && l.length < 100) {
      console.log(`  [${i}] ${l}`);
    }
  });

  // Find all buttons and tabs that might be day navigation
  const dayElements = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('button, a, [role="tab"], [role="button"], input').forEach(el => {
      const text = (el.textContent || '').trim();
      const label = el.getAttribute('aria-label') || '';
      if ((text + label).match(/monday|tuesday|wednesday|thursday|jun|day/i) && text.length < 100) {
        results.push({
          tag: el.tagName,
          text: text.substring(0, 80),
          label: label.substring(0, 80),
          role: el.getAttribute('role') || '',
          type: el.getAttribute('type') || '',
          class: (el.className || '').substring(0, 60),
        });
      }
    });
    return results;
  });
  console.log(`\n=== Day-related interactive elements: ${dayElements.length} ===`);
  dayElements.forEach(e => console.log(`  ${e.tag} [${e.role}] "${e.text}" label="${e.label}"`));

  // Check for filter/facet section that has day options
  const filterButtons = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('button').forEach(el => {
      const text = (el.textContent || '').trim();
      if (text.match(/^(expand|session\s+date|date|day|filter)/i) && text.length < 80) {
        results.push(text);
      }
    });
    return results;
  });
  console.log('\n=== Filter-related buttons ===');
  filterButtons.forEach(b => console.log(`  "${b}"`));

  // Look for all expand buttons (the filters section)
  const expandButtons = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('button').forEach(el => {
      const text = (el.textContent || '').trim();
      if (text.startsWith('Expand') || text.startsWith('expand')) {
        results.push(text);
      }
    });
    return results;
  });
  console.log('\n=== Expand buttons ===');
  expandButtons.forEach(b => console.log(`  "${b}"`));

  // Total sessions currently shown
  const sessionCount = lines.filter(l => l.match(/,\s*[A-Z]{1,5}\d+[A-Z\-]*\s*$/)).length;
  console.log(`\n=== Sessions currently visible: ${sessionCount} ===`);

  // Check what days the current sessions are on
  const dayLines = lines.filter(l => l.match(/Jun\s+\d/i));
  const dayCounts = {};
  dayLines.forEach(l => {
    const m = l.match(/Jun\s+(\d)/);
    if (m) dayCounts[`June ${m[1]}`] = (dayCounts[`June ${m[1]}`] || 0) + 1;
  });
  console.log('\nSessions by day in current view:', dayCounts);

  await browser.close();
})();
