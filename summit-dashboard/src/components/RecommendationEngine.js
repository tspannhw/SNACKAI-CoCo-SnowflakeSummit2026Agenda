/**
 * Recommendation Engine for Snowflake Summit 2026 Agenda Builder
 *
 * Scores and ranks sessions based on:
 *  1. Tim Spann boost (+100) — his sessions are always pinned to the top
 *  2. Persona-track affinity (0–30 pts) — how relevant a track is to the selected persona
 *  3. Persona fit match (+20) — whether the session's target audience includes the persona
 *  4. Interest-tag overlap (+10 per match) — how many user interests match session tags
 *  5. Format bonus — small bonus for Hands-on Labs (+3) and Keynotes (+5)
 */

// Maps each persona to track affinity weights (0.0–1.0).
// Higher weight = stronger recommendation for that persona.
const PERSONA_TRACK_WEIGHTS = {
  'Data Engineer': {
    'Data Engineering': 1.0, 'Streaming': 0.9, 'Architecture': 0.7,
    'Architectures': 0.7, 'Migration': 0.6, 'Developer': 0.5, 'AI & GenAI': 0.4,
    'AI & ML': 0.4, 'Machine Learning': 0.3, 'BI & Analytics': 0.2,
    'Platform & Optimization': 0.5, 'Data Marketplace': 0.3,
  },
  'Data Scientist': {
    'Machine Learning': 1.0, 'AI & GenAI': 0.9, 'AI & ML': 0.9, 'BI & Analytics': 0.5,
    'Data Engineering': 0.4, 'Applications': 0.3, 'Developer': 0.3,
  },
  'Architect': {
    'Architecture': 1.0, 'Architectures': 1.0, 'Governance & Security': 0.8,
    'Data Engineering': 0.7, 'Streaming': 0.6, 'Applications': 0.5,
    'Data Marketplace': 0.5, 'Collaboration & Marketplace': 0.5,
    'Migration': 0.4, 'AI & GenAI': 0.4, 'AI & ML': 0.4,
    'Platform & Optimization': 0.6,
  },
  'Developer': {
    'Developer': 1.0, 'Applications': 0.9, 'AI & GenAI': 0.7, 'AI & ML': 0.7,
    'Data Engineering': 0.5, 'Streaming': 0.4, 'Machine Learning': 0.3,
  },
  'Analyst': {
    'BI & Analytics': 1.0, 'AI & GenAI': 0.6, 'AI & ML': 0.6,
    'Governance & Security': 0.5, 'Data Engineering': 0.3, 'Industry': 0.4,
    'Data Marketplace': 0.4, 'Collaboration & Marketplace': 0.4,
  },
  'Executive': {
    'Keynote': 1.0, 'Industry': 0.9, 'Data Marketplace': 0.7,
    'Collaboration & Marketplace': 0.7, 'Governance & Security': 0.6,
    'AI & GenAI': 0.5, 'AI & ML': 0.5, 'BI & Analytics': 0.4,
    'Architecture': 0.3, 'Architectures': 0.3, 'Platform & Optimization': 0.4,
  },
  'Security': {
    'Governance & Security': 1.0, 'Architecture': 0.5, 'Architectures': 0.5,
    'AI & GenAI': 0.4, 'AI & ML': 0.4, 'Industry': 0.3,
    'Data Marketplace': 0.3, 'Collaboration & Marketplace': 0.3,
  },
};

export function scoreSession(session, persona, interests) {
  let score = 0;

  // Tim Spann bonus — always boosted
  if (session.speakers && session.speakers.toLowerCase().includes('tim spann')) {
    score += 100;
  }

  // Persona-track affinity
  const weights = PERSONA_TRACK_WEIGHTS[persona] || {};
  const trackWeight = weights[session.track] || 0.1;
  score += trackWeight * 30;

  // Persona fit match
  if (session.persona_fit) {
    const fits = session.persona_fit.split(';').map(f => f.trim());
    if (fits.includes(persona) || fits.includes('All')) {
      score += 20;
    }
  }

  // Interest-tag overlap
  if (interests.length > 0 && session.tags) {
    const sessionTags = session.tags.split(',').map(t => t.trim().toLowerCase());
    const matchCount = interests.filter(i =>
      sessionTags.some(t => t.includes(i.toLowerCase()) || i.toLowerCase().includes(t))
    ).length;
    score += matchCount * 10;
  }

  // Format bonus for hands-on
  if (session.format === 'Hands-on Lab') score += 3;
  if (session.format === 'Keynote') score += 5;

  return Math.round(score * 100) / 100;
}

export function rankSessions(sessions, persona, interests) {
  return sessions
    .map(s => ({ ...s, score: scoreSession(s, persona, interests) }))
    .sort((a, b) => b.score - a.score);
}

export function getAvailableInterests(sessions) {
  const tagSet = new Set();
  sessions.forEach(s => {
    if (s.tags) {
      s.tags.split(',').forEach(t => {
        const tag = t.trim();
        if (tag) tagSet.add(tag);
      });
    }
  });
  return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
}

export const PERSONAS = Object.keys(PERSONA_TRACK_WEIGHTS);
