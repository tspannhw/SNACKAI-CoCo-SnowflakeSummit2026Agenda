import { describe, it, expect } from 'vitest';

/**
 * Regression test: verify FORMAT_COLORS keys in SessionCard.jsx match the
 * real session format values from the catalog. This prevents the bug where
 * format names like 'Breakout Session' fall through to the gray default
 * because the key map uses a shorter name like 'Breakout'.
 */

// The real format values from the scraped catalog data
const EXPECTED_FORMATS = [
  'Breakout Session',
  'Theater Session',
  'Hands-on Lab',
  'Keynote',
  'Snowflake Training',
  'Executive Content',
  'Dev Day Luminary Talk',
  'Activation',
];

// Read the FORMAT_COLORS source directly to verify keys
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sessionCardSource = fs.readFileSync(
  path.join(__dirname, '../src/components/SessionCard.jsx'), 'utf8'
);

describe('SessionCard FORMAT_COLORS', () => {
  it('has a color entry for every real session format', () => {
    for (const format of EXPECTED_FORMATS) {
      expect(sessionCardSource).toContain(`'${format}'`);
    }
  });

  it('does not use old abbreviated format names', () => {
    // These were the old buggy keys — they should NOT appear as standalone map keys
    // (they may appear in other contexts like comments, so check specifically for map key pattern)
    const breakoutKeyPattern = /^\s*'Breakout'\s*:/m;
    const theaterKeyPattern = /^\s*'Theater'\s*:/m;
    expect(sessionCardSource).not.toMatch(breakoutKeyPattern);
    expect(sessionCardSource).not.toMatch(theaterKeyPattern);
  });
});
