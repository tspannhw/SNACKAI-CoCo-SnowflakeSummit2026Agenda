import fs from 'fs';

const speakers = JSON.parse(fs.readFileSync('scraped_speakers.json', 'utf8'));
const sessions = JSON.parse(fs.readFileSync('scraped_sessions.json', 'utf8'));
const sessionTypes = JSON.parse(fs.readFileSync('session_types.json', 'utf8'));

// Build speaker lookup: name -> {title, company}
const speakerLookup = {};
speakers.forEach(s => {
  speakerLookup[s.name.toLowerCase()] = { title: s.title, company: s.company };
});

console.log(`Speaker lookup: ${Object.keys(speakerLookup).length} entries`);

// Test lookup for Tim Spann
console.log('Tim Spann:', speakerLookup['tim spann']);

const CATALOG_BASE = 'https://reg.snowflake.com/flow/snowflake/summit26/sessions/page/catalog';
const TIM_SPANN_URL = `${CATALOG_BASE}/session/1766080156205001FeHz`;

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
    'MI': 'Migration', 'APP': 'Applications', 'STREAM': 'Streaming',
  };
  return tracks[prefix] || 'General';
}

function getFormat(code, title) {
  // Use real session type data from catalog filter
  if (code && sessionTypes[code]) {
    return sessionTypes[code].sessionType;
  }
  if (title.includes('Keynote')) return 'Keynote';
  if (title.includes('Training')) return 'Training';
  return 'Breakout Session';
}

function getDuration(code, format) {
  // Use real duration from session type data
  if (code && sessionTypes[code]) {
    return sessionTypes[code].duration;
  }
  // Fallback by format
  if (format === 'Training') return 420;
  if (format === 'Keynote') return 90;
  if (format === 'Hands-on Lab') return 90;
  if (format === 'Theater Session') return 20;
  return 45;
}

function getLevel(code) {
  if (!code) return 'All';
  const num = parseInt(code.replace(/[A-Z-]/g, ''));
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

sessions.forEach(s => {
  const track = getTrack(s.code, s.title);
  const format = getFormat(s.code, s.title);
  const level = getLevel(s.code);
  const tags = getTags(s.description, s.title);
  const personaFit = getPersonaFit(track, s.description, s.title);
  const duration = getDuration(s.code, format);

  // Look up speaker info from scraped speakers
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

  // Catalog URL
  let catalogUrl = `${CATALOG_BASE}?search=${encodeURIComponent(s.code || s.title.substring(0, 30))}&tab.sessioncatalogtab=1714168666431001NNiH`;
  if (s.speakers.includes('Tim Spann')) catalogUrl = TIM_SPANN_URL;

  let sessionId = s.code;
  if (!sessionId) {
    if (s.title.includes('Opening Keynote')) sessionId = 'K1';
    else if (s.title.includes('Platform Keynote')) sessionId = 'K2';
    else if (s.title.includes('Builders Keynote')) sessionId = 'K3';
    else if (s.title.includes('Track 1')) sessionId = 'TC1';
    else if (s.title.includes('Track 2')) sessionId = 'TC2';
    else if (s.title.includes('Track 3')) sessionId = 'TC3-M';
    else sessionId = s.title.replace(/[^A-Z0-9]/gi, '').substring(0, 10);
  }

  rows.push([
    esc(sessionId), esc(s.title), esc(s.description), esc(s.speakers),
    esc(company), esc(speakerTitle), esc(track), esc(format),
    esc(s.day), esc(s.time), esc(String(duration)), esc(''),
    esc(level), esc(tags), esc(personaFit), esc(catalogUrl)
  ].join(','));
});

fs.writeFileSync('summit_sessions.csv', rows.join('\n') + '\n');
console.log(`\nGenerated CSV with ${rows.length - 1} sessions`);

// Verify Tim Spann
const timRow = rows.find(r => r.includes('Tim Spann'));
if (timRow) {
  console.log('\nTim Spann row preview:');
  const fields = timRow.split(',');
  console.log(`  ID: ${fields[0]}, Company: ${fields[4]}, Title: ${fields[5]}`);
}

// Copy to dashboard
fs.copyFileSync('summit_sessions.csv', 'summit-dashboard/public/summit_sessions.csv');
console.log('Copied to summit-dashboard/public/');
