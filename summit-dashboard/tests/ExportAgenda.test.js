import { describe, it, expect } from 'vitest';
import { generateMarkdown, generatePDFHTML, groupByDay, esc } from '../src/components/ExportAgenda.jsx';

const MOCK_AGENDA = [
  {
    session_id: 'DE242',
    title: 'Building Real-Time, Multimodal AI Agents with Snowflake',
    description: 'Generative AI often sits isolated in experimental notebooks.',
    speakers: 'Tim Spann',
    speaker_company: 'Snowflake',
    speaker_title: 'Senior Solutions Engineer',
    track: 'Data Engineering',
    format: 'Theater Session',
    day: 'Monday June 1',
    time: '2:30 PM',
    duration_min: '20',
    level: 'Intermediate',
    tags: 'AI,Cortex,Iceberg,NiFi',
    catalog_url: 'https://reg.snowflake.com/flow/snowflake/summit26/sessions/page/catalog/session/1766080156205001FeHz',
  },
  {
    session_id: 'K1',
    title: 'Opening Keynote - K1',
    description: 'Start Snowflake Summit 26 with a look at what\'s next.',
    speakers: 'Sridhar Ramaswamy',
    speaker_company: 'Snowflake',
    speaker_title: 'Chief Executive Officer',
    track: 'Keynote',
    format: 'Keynote',
    day: 'Monday June 1',
    time: '5:00 PM',
    duration_min: '90',
    level: 'All',
    tags: 'AI,Enterprise',
    catalog_url: '',
  },
  {
    session_id: 'K2',
    title: 'Platform Keynote - K2',
    description: 'See how to move beyond AI experimentation.',
    speakers: 'Christian Kleinerman',
    speaker_company: 'Snowflake',
    speaker_title: 'EVP, Product',
    track: 'Keynote',
    format: 'Keynote',
    day: 'Tuesday June 2',
    time: '9:00 AM',
    duration_min: '90',
    level: 'All',
    tags: 'AI',
    catalog_url: '',
  },
];

describe('esc', () => {
  it('escapes HTML special characters', () => {
    expect(esc('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('escapes ampersands', () => {
    expect(esc('A & B')).toBe('A &amp; B');
  });

  it('returns empty string for null/undefined', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
    expect(esc('')).toBe('');
  });
});

describe('groupByDay', () => {
  it('groups sessions by day', () => {
    const groups = groupByDay(MOCK_AGENDA);
    expect(groups.length).toBe(2);
    expect(groups[0][0]).toBe('Monday June 1');
    expect(groups[0][1].length).toBe(2);
    expect(groups[1][0]).toBe('Tuesday June 2');
    expect(groups[1][1].length).toBe(1);
  });

  it('sorts sessions within a day by time', () => {
    const groups = groupByDay(MOCK_AGENDA);
    const monday = groups[0][1];
    expect(monday[0].time).toBe('2:30 PM');
    expect(monday[1].time).toBe('5:00 PM');
  });

  it('uses Unscheduled for sessions without a day', () => {
    const groups = groupByDay([{ session_id: 'X', day: '' }]);
    expect(groups[0][0]).toBe('Unscheduled');
  });
});

describe('generateMarkdown', () => {
  it('produces markdown with correct header', () => {
    const md = generateMarkdown(MOCK_AGENDA);
    expect(md).toContain('# My Snowflake Summit 2026 Agenda');
    expect(md).toContain('3 sessions');
  });

  it('groups sessions by day', () => {
    const md = generateMarkdown(MOCK_AGENDA);
    expect(md).toContain('## Monday June 1');
    expect(md).toContain('## Tuesday June 2');
  });

  it('includes session details', () => {
    const md = generateMarkdown(MOCK_AGENDA);
    expect(md).toContain('### DE242');
    expect(md).toContain('Tim Spann (Snowflake)');
    expect(md).toContain('Theater Session');
    expect(md).toContain('20 min');
    expect(md).toContain('Data Engineering');
  });

  it('includes catalog URL', () => {
    const md = generateMarkdown(MOCK_AGENDA);
    expect(md).toContain('1766080156205001FeHz');
  });

  it('includes description', () => {
    const md = generateMarkdown(MOCK_AGENDA);
    expect(md).toContain('Generative AI often sits isolated');
  });

  it('produces minimal output for empty agenda', () => {
    const md = generateMarkdown([]);
    expect(md).toContain('# My Snowflake Summit 2026 Agenda');
    expect(md).toContain('0 sessions');
  });
});

describe('generatePDFHTML', () => {
  it('generates valid HTML document', () => {
    const html = generatePDFHTML(MOCK_AGENDA);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
    expect(html).toContain('My Snowflake Summit 2026 Agenda');
    expect(html).toContain('3 sessions');
  });

  it('includes session data', () => {
    const html = generatePDFHTML(MOCK_AGENDA);
    expect(html).toContain('DE242');
    expect(html).toContain('Tim Spann');
    expect(html).toContain('Theater Session');
  });

  it('HTML-escapes special characters in session data', () => {
    const sessions = [{
      ...MOCK_AGENDA[0],
      title: 'Test <script>alert("xss")</script>',
      speakers: 'O\'Brien & Associates',
      day: 'Monday June 1',
    }];
    const html = generatePDFHTML(sessions);
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('groups by day', () => {
    const html = generatePDFHTML(MOCK_AGENDA);
    expect(html).toContain('Monday June 1');
    expect(html).toContain('Tuesday June 2');
  });

  it('includes catalog link when present', () => {
    const html = generatePDFHTML(MOCK_AGENDA);
    expect(html).toContain('1766080156205001FeHz');
  });

  it('includes print media query', () => {
    const html = generatePDFHTML(MOCK_AGENDA);
    expect(html).toContain('@media print');
  });
});
