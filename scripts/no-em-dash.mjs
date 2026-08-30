#!/usr/bin/env node
/**
 * Fails if an em dash, en dash, or horizontal bar appears in any tracked text
 * file. Kanzen uses plain hyphens everywhere by project policy.
 *
 *   node scripts/no-em-dash.mjs            check every tracked text file
 *   node scripts/no-em-dash.mjs --staged   check only staged files
 */
import { execSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';

// Built from code points so this file itself stays free of the characters.
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const BAR = String.fromCharCode(0x2015);
const BANNED = new RegExp(`[${EM}${EN}${BAR}]`);
const BANNED_NAMES = { [EM]: 'em dash', [EN]: 'en dash', [BAR]: 'horizontal bar' };

const TEXT_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.jsonc',
  '.md',
  '.mdx',
  '.css',
  '.scss',
  '.html',
  '.svg',
  '.yml',
  '.yaml',
  '.txt',
  '.env',
  '.example',
  '.sh',
  '.toml',
  '.graphql',
]);

const SKIP = [/node_modules\//, /dist\//, /build\//, /pnpm-lock\.yaml$/, /\.min\./];

const staged = process.argv.includes('--staged');

function listFiles() {
  const cmd = staged ? 'git diff --cached --name-only --diff-filter=ACMR' : 'git ls-files';
  try {
    return execSync(cmd, { encoding: 'utf8' })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

let violations = 0;
for (const file of listFiles()) {
  if (SKIP.some((re) => re.test(file))) continue;
  const ext = extname(file) || file;
  if (!TEXT_EXT.has(ext) && ext !== 'LICENSE') continue;
  let content;
  try {
    if (statSync(file).size > 2_000_000) continue;
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const lines = content.split(/\r?\n/);
  lines.forEach((line, i) => {
    const m = line.match(BANNED);
    if (m) {
      violations += 1;
      const name = BANNED_NAMES[m[0]] ?? 'dash-like character';
      console.error(`${file}:${i + 1}  contains ${name} (${JSON.stringify(m[0])})`);
      console.error(`    ${line.trim()}`);
    }
  });
}

if (violations > 0) {
  console.error(`\n${violations} dash violation(s) found. Replace with a plain hyphen "-".`);
  process.exit(1);
}
console.log('prose check passed: no em or en dashes found.');
