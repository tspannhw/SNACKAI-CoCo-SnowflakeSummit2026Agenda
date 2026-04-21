import fs from 'fs';

const sessions = JSON.parse(fs.readFileSync('scraped_sessions.json', 'utf8'));
const CATALOG_BASE = 'https://reg.snowflake.com/flow/snowflake/summit26/sessions/page/catalog';

// Tim Spann's known session URL
const TIM_SPANN_URL = `${CATALOG_BASE}/session/1766080156205001FeHz`;

// Map session codes to tracks based on prefix
function getTrack(code, title, desc) {
  if (!code) {
    if (title.includes('Keynote')) return 'Keynote';
    if (title.includes('Training')) return 'Training';
    return 'General';
  }
  const prefix = code.replace(/\d+.*/, '');
  const tracks = {
    'K': 'Keynote',
    'TC': 'Training',
    'DE': 'Data Engineering',
    'AI': 'AI & ML',
    'ML': 'Machine Learning',
    'BI': 'BI & Analytics',
    'GO': 'Governance & Security',
    'AR': 'Architecture',
    'PO': 'Platform & Optimization',
    'DM': 'Data Marketplace',
    'MI': 'Migration',
    'APP': 'Applications',
    'STREAM': 'Streaming',
  };
  return tracks[prefix] || 'General';
}

// Determine format from session metadata
function getFormat(code, title) {
  if (title.includes('Keynote')) return 'Keynote';
  if (title.includes('Training')) return 'Training';
  if (title.includes('Hands-on') || title.includes('hands-on') || title.includes('workshop') || title.includes('Workshop')) return 'Hands-on Lab';
  if (code && code.match(/^TC/)) return 'Training';
  return 'Breakout';
}

// Determine level based on session code suffix
function getLevel(code, desc) {
  if (!code) return 'All';
  const num = parseInt(code.replace(/[A-Z-]/g, ''));
  if (num >= 300) return 'Advanced';
  if (num >= 200) return 'Intermediate';
  if (num >= 100) return 'Beginner';
  return 'Intermediate';
}

// Extract tags from description
function getTags(desc, title, track) {
  const tags = new Set();
  const keywords = [
    'AI', 'ML', 'Cortex', 'Snowpark', 'Iceberg', 'NiFi', 'Openflow', 'Streaming',
    'dbt', 'Python', 'SQL', 'Streamlit', 'Agents', 'RAG', 'LLM', 'GenAI',
    'Governance', 'Security', 'Classification', 'Masking', 'Lineage',
    'Data Engineering', 'Pipeline', 'ETL', 'CDC', 'Dynamic Tables',
    'Marketplace', 'Data Sharing', 'Clean Room', 'Native App',
    'BI', 'Analytics', 'Dashboard', 'Visualization',
    'Migration', 'SnowConvert', 'Modernization',
    'Gen2', 'Warehouse', 'Performance', 'Cost', 'Optimization',
    'Kubernetes', 'Container', 'Docker', 'GPU',
    'Healthcare', 'Financial Services', 'Retail', 'Manufacturing',
    'Kafka', 'Real-time', 'Snowpipe', 'Feature Store', 'Model Registry',
    'Semantic', 'Intelligence', 'Natural Language',
    'Certification', 'Training', 'Hands-on',
    'Multimodal', 'Vector', 'Search', 'Notebooks',
    'Geospatial', 'IoT', 'Graph', 'Neo4j',
    'Salesforce', 'SAP', 'Workday', 'Microsoft', 'Fabric'
  ];
  const combined = `${title} ${desc}`;
  keywords.forEach(kw => {
    if (combined.toLowerCase().includes(kw.toLowerCase())) tags.add(kw);
  });
  if (tags.size === 0) tags.add(track);
  return Array.from(tags).slice(0, 8).join(',');
}

// Determine persona fit
function getPersonaFit(track, desc, title) {
  const combined = `${title} ${desc}`.toLowerCase();
  const fits = new Set();
  
  if (track === 'Keynote') return 'All';
  if (track === 'Training') return 'All';
  
  if (combined.match(/data engineer|pipeline|etl|ingestion|streaming|nifi|openflow|dbt|dynamic table|snowpipe/)) fits.add('Data Engineer');
  if (combined.match(/ml|machine learning|model|training|feature|predict|forecast|anomaly|classification/)) fits.add('Data Scientist');
  if (combined.match(/architect|multi-cloud|lakehouse|iceberg|migration|moderniz|platform|infrastructure/)) fits.add('Architect');
  if (combined.match(/develop|api|app|streamlit|container|code|build|full-stack|react/)) fits.add('Developer');
  if (combined.match(/analyt|bi\b|dashboard|visualization|self-service|natural language|intelligence|insight/)) fits.add('Analyst');
  if (combined.match(/execut|strateg|transform|business|cdo|cto|leadership|roi|cost|value/)) fits.add('Executive');
  if (combined.match(/secur|govern|compliance|privacy|classification|masking|trust|audit|risk/)) fits.add('Security');
  
  if (fits.size === 0) fits.add('Data Engineer');
  return Array.from(fits).join(';');
}

// Get speaker company from description context (best effort)
function getSpeakerInfo(speakers, desc, title) {
  // Try to extract company from description
  const companies = [];
  const knownCompanies = [
    'Snowflake', 'Capital One', 'T-Mobile', 'DraftKings', 'Ally Financial',
    'ExxonMobil', 'Boston Scientific', 'SPS Commerce', 'Canva', 'Indeed',
    'Daimler Truck', 'Fogo de Chão', 'Peoples Bank', 'LendingTree', 'Fanatics',
    'Ecolab', 'Aviva', 'Infosys', 'Pulmuone', 'Danaher', 'U.S. Bank',
    'Zendesk', 'Multnomah County', 'Sigma', 'Astronomer', 'Fivetran',
    'Salesforce', 'Informatica', 'Cyera', 'Microsoft', 'BlueCloud', 'phData',
    'Altimate.ai', 'agilon', 'ofi'
  ];
  for (const co of knownCompanies) {
    if (desc.includes(co) || title.includes(co)) {
      companies.push(co);
      break;
    }
  }
  return companies[0] || '';
}

// Build CSV rows
const header = 'session_id,title,description,speakers,speaker_company,speaker_title,track,format,day,time,duration_min,room,level,tags,persona_fit,catalog_url';
const rows = [header];

sessions.forEach(s => {
  const track = getTrack(s.code, s.title, s.description);
  const format = getFormat(s.code, s.title);
  const level = getLevel(s.code, s.description);
  const tags = getTags(s.description, s.title, track);
  const personaFit = getPersonaFit(track, s.description, s.title);
  const company = getSpeakerInfo(s.speakers, s.description, s.title);
  const duration = format === 'Training' ? 480 : format === 'Hands-on Lab' ? 90 : format === 'Keynote' ? 90 : 45;
  
  // Catalog URL: for Tim Spann we have exact URL, for others link to catalog search
  let catalogUrl = `${CATALOG_BASE}?search=${encodeURIComponent(s.code || s.title.substring(0, 30))}&tab.sessioncatalogtab=1714168666431001NNiH`;
  if (s.speakers.includes('Tim Spann')) {
    catalogUrl = TIM_SPANN_URL;
  }
  
  // Escape CSV fields
  const esc = (v) => {
    if (!v) return '';
    v = String(v);
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };

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
    esc(sessionId),
    esc(s.title),
    esc(s.description),
    esc(s.speakers),
    esc(company),
    esc(''),
    esc(track),
    esc(format),
    esc(s.day),
    esc(s.time),
    esc(String(duration)),
    esc(''),
    esc(level),
    esc(tags),
    esc(personaFit),
    esc(catalogUrl)
  ].join(','));
});

fs.writeFileSync('summit_sessions.csv', rows.join('\n') + '\n');
console.log(`Generated CSV with ${rows.length - 1} sessions`);

// Count Tim Spann sessions
const timRows = rows.filter(r => r.includes('Tim Spann'));
console.log(`Tim Spann sessions: ${timRows.length}`);
timRows.forEach(r => {
  const fields = r.split(',');
  console.log(`  ${fields[0]}: ${fields[1]?.substring(0, 60)}`);
});
