#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJsonPath = path.join(root, 'package.json');

const usage = () => {
  console.log(`Usage:
  pnpm release              # patch: 1.0.0 → 1.0.1
  pnpm release minor        # 1.0.0 → 1.1.0
  pnpm release major        # 1.0.0 → 2.0.0
  pnpm release 1.2.3        # set exact version

Requires a clean working tree on main.
`);
};

const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();

const fail = (message) => {
  console.error(`Error: ${message}`);
  process.exit(1);
};

const parseSemver = (version) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
};

const bumpVersion = (current, bump) => {
  if (bump === 'major' || bump === 'minor' || bump === 'patch') {
    const parsed = parseSemver(current);
    if (!parsed) fail(`package.json version is not semver x.y.z: ${current}`);
    if (bump === 'major') return `${parsed.major + 1}.0.0`;
    if (bump === 'minor') return `${parsed.major}.${parsed.minor + 1}.0`;
    return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
  }

  if (!parseSemver(bump)) {
    fail(`invalid version "${bump}". Use major|minor|patch or x.y.z`);
  }
  if (bump === current) fail(`version is already ${current}`);
  return bump;
};

const arg = process.argv[2] ?? 'patch';
if (arg === '-h' || arg === '--help') {
  usage();
  process.exit(0);
}

const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch !== 'main') fail(`must run on main (current: ${branch})`);

const status = run('git', ['status', '--porcelain']);
if (status) {
  fail('working tree is dirty. Commit or stash changes before releasing.');
}

run('git', ['fetch', 'origin', 'main']);
const local = run('git', ['rev-parse', 'HEAD']);
const remote = run('git', ['rev-parse', 'origin/main']);
if (local !== remote) {
  fail('main is not in sync with origin/main. Pull/push first.');
}

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const nextVersion = bumpVersion(pkg.version, arg);
const releaseBranch = `release/${nextVersion}`;
const tag = `v${nextVersion}`;

const existingBranches = run('git', ['branch', '-a']);
if (
  existingBranches
    .split('\n')
    .map((line) => line.replace(/^\*?\s+/, '').trim())
    .some(
      (name) =>
        name === releaseBranch || name === `remotes/origin/${releaseBranch}`,
    )
) {
  fail(`branch ${releaseBranch} already exists`);
}

try {
  run('git', ['rev-parse', `refs/tags/${tag}`]);
  fail(`tag ${tag} already exists locally`);
} catch {
  // tag does not exist locally
}

try {
  run('git', ['ls-remote', '--exit-code', '--tags', 'origin', `refs/tags/${tag}`]);
  fail(`tag ${tag} already exists on origin`);
} catch {
  // tag does not exist on origin
}

pkg.version = nextVersion;
fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);

run('git', ['add', 'package.json']);
run('git', ['commit', '-m', `chore: release ${tag}`]);
run('git', ['branch', releaseBranch]);
run('git', ['push', 'origin', 'main']);
run('git', ['push', '-u', 'origin', releaseBranch]);
run('git', ['branch', '-d', releaseBranch]);

console.log(`
Released ${tag}
- bumped package.json on main and pushed
- pushed ${releaseBranch} (CI will build, create the GitHub Release, then delete this branch)
- watch: gh run watch
`);
