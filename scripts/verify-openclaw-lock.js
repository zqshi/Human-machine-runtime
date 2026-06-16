#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function main() {
  const lock = JSON.parse(fs.readFileSync('versions.lock.json', 'utf8'));
  const openclaw = lock && lock.openclaw ? lock.openclaw : {};
  const expectedCommit = String(openclaw.commit || '').trim();

  if (!expectedCommit) {
    throw new Error('versions.lock.json missing openclaw commit');
  }

  // Support env override; fall back to lock file path (resolved relative to project root)
  const rawPath = process.env.OPENCLAW_SOURCE_PATH || String(openclaw.sourcePath || '').trim();
  if (!rawPath) {
    throw new Error('versions.lock.json missing openclaw sourcePath and OPENCLAW_SOURCE_PATH not set');
  }
  const sourcePath = path.resolve(rawPath);

  if (!fs.existsSync(sourcePath)) {
    console.log(JSON.stringify({ skipped: true, reason: `sourcePath not found: ${sourcePath}` }));
    process.exit(0);
  }

  const actualCommit = execSync(`git -C "${sourcePath}" rev-parse HEAD`, { stdio: ['ignore', 'pipe', 'pipe'] })
    .toString('utf8')
    .trim();

  if (actualCommit !== expectedCommit) {
    throw new Error(`OpenClaw lock mismatch. expected=${expectedCommit} actual=${actualCommit}`);
  }

  console.log(JSON.stringify({ ok: true, sourcePath, commit: actualCommit }));
}

main();
