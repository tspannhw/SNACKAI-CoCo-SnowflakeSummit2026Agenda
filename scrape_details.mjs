import { chromium } from 'playwright';
import fs from 'fs';

const sessions = JSON.parse(fs.readFileSync('scraped_sessions.json', 'utf8'));

const CATALOG_BASE = 'https://reg.snowflake.com/flow/snowflake/summit26/sessions/page/catalog';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // First, get time ranges from the catalog listing page to compute durations
  console.log('=== Loading catalog listing for time ranges ===');
  await page.goto(CATALOG_BASE + '?tab.sessioncatalogtab=1714168666431001NNiH', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000);

  // Scroll to load all sessions
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);
  }

  const catText = await page.evaluate(() => document.body.innerText);
  const catLines = catText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Extract time ranges per session from the listing
  // Pattern: session title line followed by time range line
  const timeRanges = {};
  for (let i = 0; i < catLines.length; i++) {
    const line = catLines[i];
    // Time range pattern like "Monday, Jun 12:30 PM - 3:15 PM PDT"
    const timeMatch = line.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/);
    if (timeMatch) {
      // Look backwards for the session title (usually 1-2 lines before)
      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        const titleLine = catLines[j];
        const codeMatch = titleLine.match(/,\s*([A-Z]{1,5}\d+[A-Z]?)\s*$/);
        if (codeMatch) {
          const code = codeMatch[1];
          const start = timeMatch[1];
          const end = timeMatch[2];
          
          // Compute duration in minutes
          const parseTime = (t) => {
            const [time, period] = t.trim().split(/\s+/);
            let [h, m] = time.split(':').map(Number);
            if (period === 'PM' && h < 12) h += 12;
            if (period === 'AM' && h === 12) h = 0;
            return h * 60 + m;
          };
          const duration = parseTime(end) - parseTime(start);
          
          timeRanges[code] = { start, end, duration, timeRange: `${start} - ${end}` };
          break;
        }
      }
    }
  }

  console.log(`Found time ranges for ${Object.keys(timeRanges).length} sessions`);
  Object.entries(timeRanges).forEach(([code, info]) => {
    console.log(`  ${code}: ${info.timeRange} (${info.duration} min)`);
  });

  // Now scrape individual session pages for session type info
  // We'll check a few representative sessions to understand the types
  console.log('\n=== Scraping individual session pages for type info ===');
  
  // Get session links from catalog
  // First, expand the SESSION TYPE filter to see what types exist
  const filterButton = await page.$('button:has-text("Session Type")');
  if (filterButton) {
    await filterButton.click();
    await page.waitForTimeout(2000);
    const filterText = await page.evaluate(() => document.body.innerText);
    const filterLines = filterText.split('\n').filter(l => l.trim());
    console.log('\nSession Type filter options:');
    filterLines.forEach(l => {
      if (l.match(/theater|breakout|hands|lab|keynote|lightning|demo|workshop|deep|session/i) && l.length < 80) {
        console.log('  ' + l);
      }
    });
  }

  // Scrape Tim Spann's page (we already know his ID) plus a few others to find IDs
  // Let's click on individual sessions to get their details
  const sessionDetails = {};
  
  // Navigate to each session page by clicking
  // First, let's get the RainFocus IDs from the catalog page links
  const sessionLinks = await page.evaluate(() => {
    const links = [];
    document.querySelectorAll('a[href*="/session/"]').forEach(a => {
      const href = a.href;
      const match = href.match(/\/session\/(\w+)/);
      if (match) {
        const text = a.textContent.trim().substring(0, 100);
        links.push({ id: match[1], text, href });
      }
    });
    return links;
  });
  console.log(`\nFound ${sessionLinks.length} session links`);
  sessionLinks.forEach(l => console.log(`  ${l.id}: ${l.text.substring(0, 80)}`));

  // If no direct links, we'll click on session cards instead
  if (sessionLinks.length === 0) {
    console.log('\nNo direct links found. Trying to click session cards...');
    
    // Get all clickable session elements
    const sessionButtons = await page.evaluate(() => {
      const buttons = [];
      document.querySelectorAll('button').forEach(btn => {
        const label = btn.getAttribute('aria-label') || btn.textContent.trim();
        if (label.match(/[A-Z]{2}\d{3}/) || label.includes('session')) {
          buttons.push(label.substring(0, 100));
        }
      });
      return buttons.slice(0, 10);
    });
    console.log('Session buttons:', sessionButtons);
  }

  // Let's try a different approach - visit specific session detail pages
  // by finding the RainFocus IDs from the page HTML
  const rfIds = await page.evaluate(() => {
    const html = document.documentElement.innerHTML;
    const ids = new Set();
    // RainFocus IDs are typically 20+ char alphanumeric
    const matches = html.matchAll(/\/session\/(\w{15,})/g);
    for (const m of matches) {
      ids.add(m[1]);
    }
    return [...ids];
  });
  console.log(`\nRainFocus IDs found in page: ${rfIds.length}`);
  rfIds.forEach(id => console.log(`  ${id}`));

  // Visit each session detail page to get type and duration
  const detailedSessions = [];
  const idsToCheck = rfIds.length > 0 ? rfIds : ['1766080156205001FeHz'];
  
  for (const rfId of idsToCheck.slice(0, 60)) {
    const url = `${CATALOG_BASE}/session/${rfId}`;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);
      
      const text = await page.evaluate(() => document.body.innerText);
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      // Extract session details
      let title = '', code = '', sessionType = '', sessionLength = '', level = '', tracks = '', features = '', timeRange = '';
      
      lines.forEach((l, i) => {
        if (l.match(/^[A-Z].*,\s*[A-Z]{1,5}\d+/)) {
          const parts = l.split(',');
          code = parts[parts.length - 1].trim();
          title = parts.slice(0, -1).join(',').trim();
        }
        if (l.startsWith('Session Type:')) sessionType = l.replace('Session Type:', '').trim();
        if (l.startsWith('Session Length:')) sessionLength = l.replace('Session Length:', '').trim();
        if (l.startsWith('Technical Level:')) level = l.replace('Technical Level:', '').trim();
        if (l.startsWith('Session Tracks:')) tracks = l.replace('Session Tracks:', '').trim();
        if (l.startsWith('Covered Features:')) features = l.replace('Covered Features:', '').trim();
        if (l.match(/\d{1,2}:\d{2}\s*[AP]M\s*-\s*\d{1,2}:\d{2}\s*[AP]M/)) timeRange = l;
      });
      
      if (code || title) {
        detailedSessions.push({ rfId, code, title, sessionType, sessionLength, level, tracks, features, timeRange });
        console.log(`  ${code}: ${sessionType} | ${sessionLength} | ${timeRange}`);
      }
    } catch (e) {
      console.log(`  Error loading ${rfId}: ${e.message.substring(0, 50)}`);
    }
  }

  fs.writeFileSync('scraped_session_details.json', JSON.stringify(detailedSessions, null, 2));
  console.log(`\nSaved ${detailedSessions.length} detailed sessions to scraped_session_details.json`);

  // Summary of session types
  const types = {};
  detailedSessions.forEach(s => {
    types[s.sessionType] = (types[s.sessionType] || 0) + 1;
  });
  console.log('\nSession types:');
  Object.entries(types).sort((a,b) => b[1] - a[1]).forEach(([t, c]) => console.log(`  ${t}: ${c}`));

  await browser.close();
})();
