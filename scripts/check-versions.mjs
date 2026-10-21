import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(root, relativePath), 'utf8'));
}

const targets = [
  { path: 'package.json', value: (json) => json.version },
  { path: 'apps/mobile/package.json', value: (json) => json.version },
  { path: 'apps/mobile/app.json', value: (json) => json.expo?.version },
  { path: 'apps/desktop/package.json', value: (json) => json.version },
  {
    path: 'apps/desktop/src-tauri/tauri.conf.json',
    value: (json) => json.version,
  },
];

const versions = targets.map((target) => {
  const json = readJson(target.path);
  return { path: target.path, version: target.value(json) };
});

const expected = versions[0].version;
const mismatches = versions.filter((entry) => entry.version !== expected);

if (!expected || mismatches.length > 0) {
  console.error('Version mismatch:');
  for (const entry of versions) {
    console.error(`  ${entry.path}: ${entry.version ?? '<missing>'}`);
  }
  process.exit(1);
}

const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8');
if (!changelog.includes(`## [${expected}]`)) {
  console.error(`CHANGELOG.md is missing a "## [${expected}]" section.`);
  process.exit(1);
}

console.log(`Versions are consistent: ${expected}`);
for (const entry of versions) console.log(`  ${entry.path}`);
