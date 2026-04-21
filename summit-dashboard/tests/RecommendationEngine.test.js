import { describe, it, expect } from 'vitest';
import { scoreSession, rankSessions, getAvailableInterests, PERSONAS } from '../src/components/RecommendationEngine.js';

const MOCK_SESSIONS = [
  {
    session_id: 'DE242',
    title: 'Building Real-Time, Multimodal AI Agents with Snowflake',
    speakers: 'Tim Spann',
    track: 'Data Engineering',
    format: 'Breakout',
    tags: 'AI,Cortex,Iceberg,NiFi,Agents,RAG,LLM,Kafka',
    persona_fit: 'Data Engineer;Architect;Developer',
    level: 'Intermediate',
  },
  {
    session_id: 'AI001',
    title: 'Cortex Agents: Building Enterprise AI',
    speakers: 'Snowflake AI Team',
    track: 'AI & ML',
    format: 'Breakout',
    tags: 'Cortex,Agents,AI,Enterprise',
    persona_fit: 'Developer;Data Scientist;Architect',
    level: 'Intermediate',
  },
  {
    session_id: 'GO225',
    title: 'Automated Data Classification and Pseudonymization',
    speakers: 'Chris Hastie',
    track: 'Governance & Security',
    format: 'Breakout',
    tags: 'Governance,Classification,Masking,Security',
    persona_fit: 'Security;Architect;Executive',
    level: 'Intermediate',
  },
  {
    session_id: 'K1',
    title: 'Opening Keynote - K1',
    speakers: 'Sridhar Ramaswamy',
    track: 'Keynote',
    format: 'Keynote',
    tags: 'AI,Enterprise,Strategy',
    persona_fit: 'All',
    level: 'All',
  },
  {
    session_id: 'DE110',
    title: 'Getting Your Data Cortex AI-Ready with Fivetran',
    speakers: 'Snowflake Education',
    track: 'Data Engineering',
    format: 'Hands-on Lab',
    tags: 'Streaming,Snowpipe,Hands-on',
    persona_fit: 'Data Engineer;Developer',
    level: 'Beginner',
  },
];

describe('PERSONAS', () => {
  it('exports a non-empty list of persona strings', () => {
    expect(PERSONAS).toBeInstanceOf(Array);
    expect(PERSONAS.length).toBeGreaterThanOrEqual(5);
    expect(PERSONAS).toContain('Data Engineer');
    expect(PERSONAS).toContain('Data Scientist');
    expect(PERSONAS).toContain('Architect');
    expect(PERSONAS).toContain('Developer');
    expect(PERSONAS).toContain('Analyst');
    expect(PERSONAS).toContain('Executive');
    expect(PERSONAS).toContain('Security');
  });
});

describe('scoreSession', () => {
  it('gives Tim Spann sessions a massive boost (100+ points)', () => {
    const score = scoreSession(MOCK_SESSIONS[0], 'Data Engineer', []);
    expect(score).toBeGreaterThanOrEqual(100);
  });

  it('scores Tim Spann higher than any non-Tim-Spann session regardless of persona', () => {
    const tspannScore = scoreSession(MOCK_SESSIONS[0], 'Executive', []);
    const otherScores = MOCK_SESSIONS.slice(1).map(s => scoreSession(s, 'Executive', []));
    const maxOther = Math.max(...otherScores);
    expect(tspannScore).toBeGreaterThan(maxOther);
  });

  it('scores higher when persona matches track affinity', () => {
    const deScore = scoreSession(MOCK_SESSIONS[0], 'Data Engineer', []);
    const secScore = scoreSession(MOCK_SESSIONS[0], 'Security', []);
    // Tim Spann bonus dominates, but the DE persona should add more track affinity
    // Both get 100 for Tim Spann, but DE gets higher track weight for Data Engineering
    expect(deScore).toBeGreaterThan(secScore);
  });

  it('increases score when interests match session tags', () => {
    const noInterests = scoreSession(MOCK_SESSIONS[1], 'Developer', []);
    const withInterests = scoreSession(MOCK_SESSIONS[1], 'Developer', ['AI', 'Cortex']);
    expect(withInterests).toBeGreaterThan(noInterests);
  });

  it('gives persona_fit bonus when persona matches', () => {
    const govForSecurity = scoreSession(MOCK_SESSIONS[2], 'Security', []);
    const govForDeveloper = scoreSession(MOCK_SESSIONS[2], 'Developer', []);
    expect(govForSecurity).toBeGreaterThan(govForDeveloper);
  });

  it('gives bonus for Hands-on Lab format', () => {
    const lab = scoreSession(MOCK_SESSIONS[4], 'Data Engineer', []);
    // Create a breakout version of the same session
    const breakout = scoreSession({ ...MOCK_SESSIONS[4], format: 'Breakout' }, 'Data Engineer', []);
    expect(lab).toBeGreaterThan(breakout);
  });

  it('gives bonus for Keynote format', () => {
    const keynoteScore = scoreSession(MOCK_SESSIONS[3], 'Executive', []);
    const breakoutScore = scoreSession({ ...MOCK_SESSIONS[3], format: 'Breakout' }, 'Executive', []);
    expect(keynoteScore).toBeGreaterThan(breakoutScore);
  });
});

describe('rankSessions', () => {
  it('returns all sessions sorted by score descending', () => {
    const ranked = rankSessions(MOCK_SESSIONS, 'Data Engineer', []);
    expect(ranked.length).toBe(MOCK_SESSIONS.length);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });

  it('always ranks Tim Spann sessions first', () => {
    const ranked = rankSessions(MOCK_SESSIONS, 'Data Engineer', []);
    expect(ranked[0].session_id).toBe('DE242');
  });

  it('always ranks Tim Spann first even for non-matching personas', () => {
    const ranked = rankSessions(MOCK_SESSIONS, 'Security', []);
    expect(ranked[0].session_id).toBe('DE242');
  });

  it('attaches a numeric score to each session', () => {
    const ranked = rankSessions(MOCK_SESSIONS, 'Developer', ['AI']);
    ranked.forEach(s => {
      expect(typeof s.score).toBe('number');
      expect(s.score).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('getAvailableInterests', () => {
  it('extracts unique sorted tags from sessions', () => {
    const interests = getAvailableInterests(MOCK_SESSIONS);
    expect(interests).toBeInstanceOf(Array);
    expect(interests.length).toBeGreaterThan(0);
    // Should be sorted
    for (let i = 1; i < interests.length; i++) {
      expect(interests[i - 1].localeCompare(interests[i])).toBeLessThanOrEqual(0);
    }
  });

  it('includes known tags from mock data', () => {
    const interests = getAvailableInterests(MOCK_SESSIONS);
    expect(interests).toContain('AI');
    expect(interests).toContain('Cortex');
    expect(interests).toContain('Governance');
  });

  it('returns empty array for sessions with no tags', () => {
    const interests = getAvailableInterests([{ session_id: 'X', tags: '' }]);
    expect(interests).toEqual([]);
  });
});
