import { chromium } from 'playwright';
import fs from 'fs';

const URL = 'https://reg.snowflake.com/flow/snowflake/summit26/speakers/page/catalog';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Opening speakers catalog...');
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000);

  // Scroll to load all speakers
  let prevCount = 0;
  let stableCount = 0;
  for (let i = 0; i < 100; i++) {
    const count = await page.evaluate(() => document.querySelectorAll('h4').length);
    if (count === prevCount) {
      stableCount++;
      if (stableCount > 5) {
        console.log(`Scroll done at iteration ${i}: ${count} speakers`);
        break;
      }
    } else {
      stableCount = 0;
    }
    prevCount = count;
    if (i % 10 === 0) console.log(`  Scroll ${i}: ${count} speakers`);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);
  }

  // Extract speaker data
  const speakers = await page.evaluate(() => {
    const results = [];
    const seen = new Set();
    
    document.querySelectorAll('h4').forEach(h4 => {
      const name = h4.textContent.trim();
      if (!name || name === 'Your Privacy' || name.includes('Cookies')) return;
      if (seen.has(name)) return;
      seen.add(name);

      const container = h4.closest('li') || h4.parentElement?.parentElement?.parentElement;
      
      // Get title and company from surrounding text
      let title = '', company = '';
      if (container) {
        const paragraphs = container.querySelectorAll('p');
        paragraphs.forEach(p => {
          const text = p.textContent.trim();
          if (text && text !== name && text.length < 200) {
            if (!title) title = text;
            else if (!company) company = text;
          }
        });
        
        // Also check spans
        const spans = container.querySelectorAll('span');
        spans.forEach(sp => {
          const text = sp.textContent.trim();
          if (text && text !== name && text.length < 100 && text.length > 2) {
            if (!title && !text.includes('Add') && !text.includes('Favorite')) title = text;
          }
        });
      }

      // Try to get speaker link/image URL for speaker page
      let href = '';
      if (container) {
        const link = container.querySelector('a[href*="speaker"]');
        if (link) href = link.href;
      }

      results.push({ name, title, company, href });
    });
    
    return results;
  });

  console.log(`\nExtracted ${speakers.length} speakers`);
  
  // Find Tim Spann
  const tim = speakers.find(s => s.name.toLowerCase().includes('spann'));
  if (tim) {
    console.log('\n=== TIM SPANN ===');
    console.log(JSON.stringify(tim, null, 2));
  }

  // Print first 20 speakers
  console.log('\n=== First 20 Speakers ===');
  speakers.slice(0, 20).forEach(s => {
    console.log(`  ${s.name} | ${s.title} | ${s.company}`);
  });

  // Save all speakers
  fs.writeFileSync('scraped_speakers.json', JSON.stringify(speakers, null, 2));
  console.log(`\nSaved ${speakers.length} speakers to scraped_speakers.json`);

  await browser.close();
})();
