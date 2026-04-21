import fs from 'fs';

// Load all data sources
const domSessions = JSON.parse(fs.readFileSync('scraped_sessions.json', 'utf8'));
const apiSessions = JSON.parse(fs.readFileSync('api_sessions_all.json', 'utf8'));
const typeMapRaw = JSON.parse(fs.readFileSync('session_types_all.json', 'utf8'));

// Load speakers if available
let speakers = [];
try { speakers = JSON.parse(fs.readFileSync('scraped_speakers.json', 'utf8')); } catch (e) {}

// Build lookups
const apiByCode = {};
apiSessions.forEach(item => { apiByCode[item.code] = item; });

const speakerLookup = {};
speakers.forEach(s => {
  speakerLookup[s.name.toLowerCase()] = { title: s.title, company: s.company };
});

console.log(`DOM sessions: ${domSessions.length}`);
console.log(`API sessions: ${apiSessions.length}`);
console.log(`Type mappings: ${Object.keys(typeMapRaw).length}`);
console.log(`Speaker lookup: ${Object.keys(speakerLookup).length} entries`);

const CATALOG_BASE = 'https://reg.snowflake.com/flow/snowflake/summit26/sessions/page/catalog';

function getTrack(code, title) {
  if (!code) {
    if (title.includes('Keynote')) return 'Keynote';
    if (title.includes('Training')) return 'Training';
    return 'General';
  }
  const prefix = code.replace(/\d+.*/, '');
  const tracks = {
    'K': 'Keynote', 'TC': 'Training', 'DE': 'Data Engineering',
    'AI': 'AI & ML', 'ML': 'Machine Learning', 'BI': 'BI & Analytics',
    'GO': 'Governance & Security', 'AR': 'Architecture',
    'PO': 'Platform & Optimization', 'DM': 'Data Marketplace',
    'MI': 'Migration', 'IN': 'Industry Solutions', 'AD': 'Administration',
    'ACT': 'Activation', 'WN': 'What\'s New', 'E': 'Executive',
    'L': 'Lightning Talk',
  };
  return tracks[prefix] || 'General';
}

function getFormat(code) {
  // Priority 1: API data (has exact type)
  if (apiByCode[code]) return apiByCode[code].type;
  // Priority 2: Filter-scraped types
  if (typeMapRaw[code]) return typeMapRaw[code];
  // Priority 3: Inference from code
  if (code.startsWith('K')) return 'Keynote';
  if (code.startsWith('TC')) return 'Snowflake Training';
  if (code.startsWith('ACT')) return 'Activation';
  return 'Breakout Session';
}

function getDuration(code, format) {
  // Priority 1: API data (has exact length in minutes)
  if (apiByCode[code]) {
    const t = apiByCode[code].times?.[0];
    if (t) return t.length || (t.endTimeMin - t.startTimeMin);
  }
  // Priority 2: By format
  const durations = {
    'Snowflake Training': 420,
    'Keynote': 90,
    'Hands-on Lab': 90,
    'Theater Session': 20,
    'Breakout Session': 45,
    'Executive Content': 45,
    'Dev Day Luminary Talk': 20,
    'Activation': 30,
  };
  return durations[format] || 45;
}

function getTime(code, domTime) {
  // Priority 1: API data (properly formatted)
  if (apiByCode[code]) {
    const t = apiByCode[code].times?.[0];
    if (t) return `${t.startTimeFormatted} - ${t.endTimeFormatted}`;
  }
  // Priority 2: DOM time (may have merged day number issue)
  if (domTime) {
    // Fix the merged day number: "19:00 AM - 4:30 PM" -> "9:00 AM - 4:30 PM"
    // The pattern is: the day digit (1-4) is prepended to the start time hour
    return domTime.replace(/^1(\d{1,2}:\d{2}\s*[AP]M)/, '$1')
                   .replace(/^2(\d{1,2}:\d{2}\s*[AP]M)/, '$1')
                   .replace(/^3(\d{1,2}:\d{2}\s*[AP]M)/, '$1')
                   .replace(/^4(\d{1,2}:\d{2}\s*[AP]M)/, '$1');
  }
  return '';
}

function getDay(code, domDay) {
  let day = '';
  if (apiByCode[code]) {
    const t = apiByCode[code].times?.[0];
    if (t) day = `${t.dayName} June ${t.day}`;
  }
  if (!day) day = domDay || '';
  // Normalize "June 01" -> "June 1" (remove leading zero)
  return day.replace(/June 0(\d)/, 'June $1');
}

function getRoom(code) {
  if (apiByCode[code]) {
    const t = apiByCode[code].times?.[0];
    if (t && t.room) return t.room;
  }
  return '';
}

function getDescription(code, domDesc) {
  if (apiByCode[code] && apiByCode[code].abstract) {
    // API abstract is usually better (full HTML-free text)
    return apiByCode[code].abstract.replace(/<[^>]+>/g, '').trim();
  }
  return domDesc || '';
}

function getLevel(code) {
  if (!code) return 'All';
  const num = parseInt(code.replace(/[A-Z-]/g, ''));
  if (isNaN(num)) return 'All';
  if (num >= 300) return 'Advanced';
  if (num >= 200) return 'Intermediate';
  if (num >= 100) return 'Beginner';
  return 'Intermediate';
}

function getTags(desc, title) {
  const tags = new Set();
  const keywords = [
    'AI', 'ML', 'Cortex', 'Snowpark', 'Iceberg', 'NiFi', 'Openflow', 'Streaming',
    'dbt', 'Python', 'SQL', 'Streamlit', 'Agents', 'RAG', 'LLM', 'GenAI',
    'Governance', 'Security', 'Classification', 'Masking', 'Lineage',
    'Pipeline', 'ETL', 'CDC', 'Dynamic Tables',
    'Marketplace', 'Data Sharing', 'Clean Room', 'Native App',
    'Analytics', 'Dashboard', 'Visualization',
    'Migration', 'SnowConvert', 'Modernization',
    'Gen2', 'Warehouse', 'Performance', 'Cost', 'Optimization',
    'Container', 'GPU', 'Healthcare', 'Financial Services', 'Retail',
    'Kafka', 'Real-time', 'Snowpipe', 'Feature Store',
    'Semantic', 'Intelligence', 'Natural Language',
    'Multimodal', 'Vector', 'Search', 'Geospatial',
    'Salesforce', 'SAP', 'Microsoft', 'Fabric'
  ];
  const combined = `${title} ${desc}`;
  keywords.forEach(kw => {
    if (combined.toLowerCase().includes(kw.toLowerCase())) tags.add(kw);
  });
  return Array.from(tags).slice(0, 8).join(',');
}

function getPersonaFit(track, desc, title) {
  const combined = `${title} ${desc}`.toLowerCase();
  const fits = new Set();
  if (track === 'Keynote' || track === 'Training') return 'All';
  if (combined.match(/data engineer|pipeline|etl|ingestion|streaming|nifi|openflow|dbt|dynamic table|snowpipe/)) fits.add('Data Engineer');
  if (combined.match(/ml|machine learning|model|training|feature|predict|forecast|anomaly/)) fits.add('Data Scientist');
  if (combined.match(/architect|multi-cloud|lakehouse|iceberg|migration|moderniz|platform|infrastructure/)) fits.add('Architect');
  if (combined.match(/develop|api|app|streamlit|container|code|build|full-stack/)) fits.add('Developer');
  if (combined.match(/analyt|dashboard|visualization|self-service|natural language|intelligence|insight/)) fits.add('Analyst');
  if (combined.match(/execut|strateg|transform|business|cdo|cto|leadership|roi|cost|value/)) fits.add('Executive');
  if (combined.match(/secur|govern|compliance|privacy|classification|masking|trust|audit|risk/)) fits.add('Security');
  if (fits.size === 0) fits.add('Data Engineer');
  return Array.from(fits).join(';');
}

const esc = (v) => {
  if (!v) return '';
  v = String(v);
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
};

const header = 'session_id,title,description,speakers,speaker_company,speaker_title,track,format,day,time,duration_min,room,level,tags,persona_fit,catalog_url';
const rows = [header];

domSessions.forEach(s => {
  const code = s.code;
  const title = apiByCode[code] ? apiByCode[code].title : s.title;
  const description = getDescription(code, s.description);
  const track = getTrack(code, title);
  const format = getFormat(code);
  const level = getLevel(code);
  const tags = getTags(description, title);
  const personaFit = getPersonaFit(track, description, title);
  const duration = getDuration(code, format);
  const time = getTime(code, s.time);
  const day = getDay(code, s.day);
  const room = getRoom(code);

  // Speaker enrichment
  const speakerNames = s.speakers.split(';').map(n => n.trim()).filter(Boolean);
  let company = '', speakerTitle = '';
  for (const name of speakerNames) {
    const lookup = speakerLookup[name.toLowerCase()];
    if (lookup) {
      if (!company && lookup.company) company = lookup.company;
      if (!speakerTitle && lookup.title) speakerTitle = lookup.title;
      break;
    }
  }

  const catalogUrl = `${CATALOG_BASE}?search=${encodeURIComponent(code)}&tab.sessioncatalogtab=1714168666431001NNiH`;

  rows.push([
    esc(code), esc(title), esc(description), esc(s.speakers),
    esc(company), esc(speakerTitle), esc(track), esc(format),
    esc(day), esc(time), esc(String(duration)), esc(room),
    esc(level), esc(tags), esc(personaFit), esc(catalogUrl)
  ].join(','));
});

fs.writeFileSync('summit_sessions.csv', rows.join('\n') + '\n');
console.log(`\nGenerated CSV with ${rows.length - 1} sessions`);

// Stats
const byDay = {};
const byFormat = {};
domSessions.forEach(s => {
  const day = getDay(s.code, s.day);
  byDay[day] = (byDay[day] || 0) + 1;
  const fmt = getFormat(s.code);
  byFormat[fmt] = (byFormat[fmt] || 0) + 1;
});
console.log('\nBy day:', byDay);
console.log('By format:', byFormat);

// Verify Tim Spann
const timRow = rows.find(r => r.includes('DE242'));
if (timRow) {
  console.log('\nDE242 (Tim Spann) row:');
  const fields = timRow.match(/(".*?"|[^,]*)/g);
  console.log(`  Session: ${fields[0]}`);
  console.log(`  Title: ${fields[1]}`);
  console.log(`  Format: ${fields[7]}`);
  console.log(`  Duration: ${fields[10]}`);
  console.log(`  Day: ${fields[8]}`);
  console.log(`  Time: ${fields[9]}`);
}

// Copy to dashboard
fs.copyFileSync('summit_sessions.csv', 'summit-dashboard/public/summit_sessions.csv');
console.log('\nCopied to summit-dashboard/public/');
