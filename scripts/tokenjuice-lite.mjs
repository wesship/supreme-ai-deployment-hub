#!/usr/bin/env node
import fs from 'node:fs';

const input = process.argv[2];

if (!input) {
  console.error('Usage: node scripts/tokenjuice-lite.mjs <file>');
  process.exit(1);
}

const raw = fs.readFileSync(input, 'utf8');

const normalized = raw
  .replace(/https?:\/\/\S+/g, '[url]')
  .replace(/\s+/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .trim();

const deduped = [...new Set(normalized.split(/(?<=[.!?])\s+/))].join(' ');

const result = deduped
  .replace(/\b(ERROR|WARN|INFO|DEBUG)\b/g, '')
  .replace(/\s+/g, ' ')
  .trim();

console.log(result);
