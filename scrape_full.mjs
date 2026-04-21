import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'https://reg.snowflake.com/flow/snowflake/summit26/sessions/page/catalog';
const URL = `${BASE}?tab.sessioncatalogtab=1714168666431001NNiH`;
const CATALOG_BASE = `${BASE}/session/`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Opening catalog...');
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Intercept XHR/fetch calls to find the RainFocus API
  const apiResponses = [];
  page.on('response', async resp => {
    const url = resp.url();
    if (url.includes('search') || url.includes('session') || url.includes('catalog') || url.includes('rfapi') || url.includes('widget')) {
      try {
        const body = await resp.text();
        if (body.length > 100) {
          apiResponses.push({ url, status: resp.status(), bodyLength: body.length, bodyPreview: body.substring(0, 500) });
        }
      } catch {}
    }
  });

  // Scroll to load all sessions. The page likely lazy-loads.
  let prevCount = 0;
  let scrollAttempts = 0;
  while (scrollAttempts < 50) {
    const count = await page.evaluate(() => document.querySelectorAll('h4').length);
    console.log(`Scroll ${scrollAttempts}: ${count} sessions found`);
    if (count === prevCount && scrollAttempts > 3) break;
    prevCount = count;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
    scrollAttempts++;
  }

  // Now extract all session data including links
  const sessions = await page.evaluate((catalogBase) => {
    const results = [];
    const seen = new Set();
    
    // Get all session items by looking at h4 elements and their containers
    document.querySelectorAll('h4').forEach(h4 => {
      const title = h4.textContent.trim();
      if (!title || title === 'Your Privacy' || title.includes('Cookies')) return;
      if (seen.has(title)) return;
      seen.add(title);

      const container = h4.closest('li') || h4.closest('[role="listitem"]') || h4.parentElement?.parentElement?.parentElement;
      
      // Extract session code from title (e.g., "..., DE242")
      const codeMatch = title.match(/,\s*([A-Z]{2}\d{3})\s*$/);
      const code = codeMatch ? codeMatch[1] : '';
      const cleanTitle = codeMatch ? title.replace(/,\s*[A-Z]{2}\d{3}\s*$/, '').trim() : title;

      // Get description
      const descEl = container?.querySelector('p p') || container?.querySelector('p');
      const description = descEl?.textContent?.trim()?.substring(0, 500) || '';

      // Get speakers from button labels
      const speakers = [];
      if (container) {
        container.querySelectorAll('button[aria-label*="speaker"]').forEach(b => {
          const label = b.getAttribute('aria-label') || '';
          const match = label.match(/^(.+?)\s+speaker for/);
          if (match) speakers.push(match[1]);
        });
      }

      // Get schedule info from button label
      let day = '', time = '';
      if (container) {
        const schedBtn = container.querySelector('button[aria-label*="schedule"]');
        if (schedBtn) {
          const label = schedBtn.getAttribute('aria-label') || '';
          const dayMatch = label.match(/on\s+(Monday|Tuesday|Wednesday|Thursday),\s+Jun\s+(\d)/);
          if (dayMatch) {
            const dayName = dayMatch[1];
            const dayNum = dayMatch[2];
            day = `${dayName} June ${dayNum}`;
          }
          const timeMatch = label.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s+PDT/);
          if (timeMatch) time = timeMatch[1];
        }
      }

      // Try to find the session link/href
      let href = '';
      if (container) {
        const link = container.querySelector('a[href*="session/"]');
        if (link) href = link.href;
      }
      // If no link found via anchor, try to find the clickable title
      if (!href) {
        const clickable = h4.querySelector('[cursor]') || h4.querySelector('span[role="link"]') || h4.querySelector('a');
        if (clickable?.href) href = clickable.href;
      }

      results.push({
        code,
        title: cleanTitle,
        description,
        speakers: speakers.join('; '),
        day,
        time,
        href
      });
    });
    
    return results;
  }, CATALOG_BASE);

  // Filter out cookie/privacy entries
  const filtered = sessions.filter(s => s.day || s.code);

  console.log(`\nExtracted ${filtered.length} sessions`);
  
  // Also try to find session detail links by clicking on a session title
  // First, let's check if the page uses hash-based URLs
  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);

  // Try clicking on the first session title to see if URL changes
  const firstTitle = await page.$('h4 span[cursor="pointer"], h4 [role="link"]');
  if (firstTitle) {
    const titleText = await firstTitle.textContent();
    console.log(`Clicking on: ${titleText}`);
    await firstTitle.click();
    await page.waitForTimeout(3000);
    const newUrl = page.url();
    console.log(`URL after click: ${newUrl}`);
    
    // Check if a modal or detail view opened
    const detailContent = await page.evaluate(() => {
      // Look for a modal or expanded content
      const modal = document.querySelector('[role="dialog"]') || 
                    document.querySelector('.modal') || 
                    document.querySelector('[class*="detail"]') ||
                    document.querySelector('[class*="overlay"]');
      if (modal) return modal.textContent.substring(0, 500);
      return 'No modal found';
    });
    console.log('Detail content:', detailContent);
  }

  // Write all sessions to JSON
  fs.writeFileSync('scraped_sessions.json', JSON.stringify(filtered, null, 2));
  console.log(`\nSaved ${filtered.length} sessions to scraped_sessions.json`);

  // Also check for any API calls we intercepted
  if (apiResponses.length > 0) {
    console.log('\n=== Intercepted API Responses ===');
    apiResponses.forEach(r => {
      console.log(`  ${r.url} (${r.status}) - ${r.bodyLength} bytes`);
      console.log(`  Preview: ${r.bodyPreview.substring(0, 200)}`);
    });
  }

  // Print Tim Spann's session specifically
  const timSession = filtered.find(s => 
    s.title.toLowerCase().includes('spann') || 
    s.speakers.toLowerCase().includes('spann') ||
    s.description.toLowerCase().includes('spann') ||
    s.title.includes('DE242')
  );
  if (timSession) {
    console.log('\n=== TIM SPANN SESSION ===');
    console.log(JSON.stringify(timSession, null, 2));
  }

  await browser.close();
})();
