import { chromium } from 'playwright';
import fs from 'fs';

const URL = 'https://reg.snowflake.com/flow/snowflake/summit26/speakers/page/catalog';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Opening speakers catalog...');
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(10000);

  // Scroll to load all speakers
  let prevText = '';
  for (let i = 0; i < 50; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    const text = await page.evaluate(() => document.body.innerText.length);
    if (i % 10 === 0) console.log(`  Scroll ${i}: ${text} chars`);
    if (text === prevText) break;
    prevText = text;
  }

  // Extract speakers from the speaker class elements
  const speakers = await page.evaluate(() => {
    const results = [];
    const seen = new Set();
    
    // Each speaker card has class containing "speaker"
    document.querySelectorAll('[class*="speaker"]').forEach(el => {
      const text = el.textContent.trim();
      // Speaker cards have format: "NameTitleCompany"
      // They also have buttons inside for click
      const button = el.querySelector('button[aria-label*="speaker"]');
      if (!button) return;
      
      const label = button.getAttribute('aria-label') || '';
      // Label format: "Name speaker" or similar
      const name = label.replace(/\s*speaker.*$/i, '').trim();
      if (!name || seen.has(name)) return;
      seen.add(name);
      
      // Get paragraphs inside for title and company
      const ps = el.querySelectorAll('p');
      let title = '', company = '';
      ps.forEach(p => {
        const pt = p.textContent.trim();
        if (pt && pt !== name) {
          if (!title) title = pt;
          else if (!company) company = pt;
        }
      });
      
      results.push({ name, title, company });
    });
    
    return results;
  });

  console.log(`\nExtracted ${speakers.length} speakers`);

  // If that didn't work well, try parsing the body text directly
  if (speakers.length < 50) {
    console.log('\nFallback: parsing body text...');
    const bodyText = await page.evaluate(() => document.body.innerText);
    const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // Find speaker section - starts after "SPEAKERS"
    const speakerIdx = lines.findIndex(l => l === 'SPEAKERS');
    if (speakerIdx >= 0) {
      const speakerLines = lines.slice(speakerIdx + 1);
      // Parse triplets: Name, Title, Company
      const parsedSpeakers = [];
      const seen2 = new Set();
      
      for (let i = 0; i < speakerLines.length - 2; i++) {
        const line = speakerLines[i];
        // Stop at footer-like content
        if (line.includes('Copyright') || line === 'Your Privacy') break;
        
        // A name line is typically short (< 40 chars), no special chars
        // Title follows, then company
        if (line.length < 50 && line.length > 3 && !line.includes('©') && !line.includes('|')) {
          const nextLine = speakerLines[i + 1] || '';
          const companyLine = speakerLines[i + 2] || '';
          
          // Heuristic: name doesn't contain typical title words
          if (!line.match(/^(VP|SVP|EVP|CEO|CTO|Director|Manager|Head|Chief|Senior|Principal|Staff|Lead|Engineer|Architect)/)) {
            // Check if next line looks like a title
            if (nextLine.length > 3 && nextLine.length < 120) {
              if (!seen2.has(line)) {
                seen2.add(line);
                parsedSpeakers.push({
                  name: line,
                  title: nextLine,
                  company: companyLine
                });
                i += 2; // Skip title and company lines
              }
            }
          }
        }
      }
      
      console.log(`Parsed ${parsedSpeakers.length} speakers from text`);
      
      // Use parsed speakers if we got more
      if (parsedSpeakers.length > speakers.length) {
        speakers.length = 0;
        speakers.push(...parsedSpeakers);
      }
    }
  }

  // Find Tim Spann
  const tim = speakers.find(s => s.name.toLowerCase().includes('spann'));
  if (tim) {
    console.log('\n=== TIM SPANN ===');
    console.log(JSON.stringify(tim, null, 2));
  } else {
    // Search in all text
    const bodyText = await page.evaluate(() => document.body.innerText);
    const spannIdx = bodyText.toLowerCase().indexOf('spann');
    if (spannIdx >= 0) {
      console.log('\n=== Tim Spann context ===');
      console.log(bodyText.substring(Math.max(0, spannIdx - 100), spannIdx + 200));
    }
  }

  // Print stats
  console.log(`\nTotal speakers: ${speakers.length}`);
  console.log('First 10:', speakers.slice(0, 10).map(s => `${s.name} (${s.company})`).join(', '));
  
  fs.writeFileSync('scraped_speakers.json', JSON.stringify(speakers, null, 2));
  console.log(`Saved to scraped_speakers.json`);

  await browser.close();
})();
