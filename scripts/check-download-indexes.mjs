#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const IMAGE_EXTENSIONS = new Set([
  '.avif',
  '.bmp',
  '.gif',
  '.jfif',
  '.jpeg',
  '.jpg',
  '.png',
  '.webp',
]);

const usage = () => {
  console.log(`Usage:
  node scripts/check-download-indexes.mjs <folder> [options]
  pnpm check:indexes <folder> [options]

Options:
  --start=<n>          Expected first index. Default: 1
  --end=<n>            Expected last index. Default: max parsed index
  --recursive          Scan subfolders too
  --all-files          Include non-image files
  --pattern=<regex>    Regex with the index in capture group 1. Default: ^(\\d+)(?:\\D|$)

Examples:
  pnpm check:indexes "D:\\Downloads\\gallery"
  pnpm check:indexes "D:\\Downloads\\gallery" 240
  pnpm check:indexes "D:\\Downloads\\gallery" 18-24
  pnpm check:indexes "D:\\Downloads\\gallery" --pattern="^page-(\\d+)-"
`);
};

const parseRangeArg = (arg) => {
  const endMatch = /^(\d+)$/.exec(arg);
  if (endMatch) {
    return { start: 1, end: Number(endMatch[1]) };
  }

  const rangeMatch = /^(\d+)-(\d+)$/.exec(arg);
  if (rangeMatch) {
    return {
      start: Number(rangeMatch[1]),
      end: Number(rangeMatch[2]),
    };
  }

  return null;
};

const parseArgs = (argv) => {
  const options = {
    allFiles: false,
    end: undefined,
    folder: '',
    pattern: /^(\d+)(?:\D|$)/,
    recursive: false,
    start: 1,
  };
  let rangeSet = false;

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
    if (arg === '--recursive') {
      options.recursive = true;
      continue;
    }
    if (arg === '--all-files') {
      options.allFiles = true;
      continue;
    }
    if (arg.startsWith('--start=')) {
      options.start = Number(arg.slice('--start='.length));
      continue;
    }
    if (arg.startsWith('--end=')) {
      options.end = Number(arg.slice('--end='.length));
      continue;
    }
    if (arg.startsWith('--pattern=')) {
      options.pattern = new RegExp(arg.slice('--pattern='.length));
      continue;
    }
    if (!options.folder) {
      options.folder = arg;
      continue;
    }
    const range = parseRangeArg(arg);
    if (range && !rangeSet) {
      options.start = range.start;
      options.end = range.end;
      rangeSet = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.folder) {
    usage();
    process.exit(1);
  }
  if (!Number.isInteger(options.start) || options.start < 0) {
    throw new Error('--start must be a non-negative integer');
  }
  if (options.end !== undefined && (!Number.isInteger(options.end) || options.end < options.start)) {
    throw new Error('--end must be an integer greater than or equal to --start');
  }

  return options;
};

const walkFiles = async (folder, recursive) => {
  const entries = await fs.readdir(folder, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      if (recursive) files.push(...(await walkFiles(fullPath, recursive)));
      continue;
    }
    if (entry.isFile()) files.push(fullPath);
  }

  return files;
};

const naturalCompare = (a, b) =>
  a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: 'base',
  });

const toRanges = (numbers) => {
  if (numbers.length === 0) return 'none';

  const ranges = [];
  let start = numbers[0];
  let prev = numbers[0];

  for (let i = 1; i < numbers.length; i += 1) {
    const current = numbers[i];
    if (current === prev + 1) {
      prev = current;
      continue;
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = current;
    prev = current;
  }

  ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
  return ranges.join(', ');
};

const formatRelative = (folder, file) => path.relative(folder, file).replace(/\\/g, '/');

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const folder = path.resolve(options.folder);
  const stat = await fs.stat(folder);
  if (!stat.isDirectory()) throw new Error(`Not a directory: ${folder}`);

  const files = (await walkFiles(folder, options.recursive))
    .filter((file) => options.allFiles || IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()))
    .sort(naturalCompare);

  const parsed = [];
  const unparsed = [];

  for (const file of files) {
    const base = path.basename(file);
    const match = options.pattern.exec(base);
    const index = match?.[1] ? Number(match[1]) : NaN;
    if (Number.isInteger(index)) {
      parsed.push({ file, index });
    } else {
      unparsed.push(file);
    }
  }

  const maxIndex = parsed.length ? Math.max(...parsed.map((item) => item.index)) : options.start - 1;
  const expectedEnd = options.end ?? maxIndex;
  const byIndex = new Map();
  for (const item of parsed) {
    const list = byIndex.get(item.index) ?? [];
    list.push(item.file);
    byIndex.set(item.index, list);
  }

  const missing = [];
  for (let index = options.start; index <= expectedEnd; index += 1) {
    if (!byIndex.has(index)) missing.push(index);
  }

  const duplicates = [...byIndex.entries()]
    .filter(([, list]) => list.length > 1)
    .sort(([a], [b]) => a - b);

  const outOfExpectedRange = parsed
    .filter((item) => item.index < options.start || item.index > expectedEnd)
    .sort((a, b) => a.index - b.index);

  const orderIssues = [];
  for (let i = 1; i < parsed.length; i += 1) {
    if (parsed[i].index <= parsed[i - 1].index) {
      orderIssues.push([parsed[i - 1], parsed[i]]);
    }
  }

  console.log(`Folder: ${folder}`);
  console.log(`Files scanned: ${files.length}`);
  console.log(`Parsed indexes: ${parsed.length}`);
  console.log(`Expected range: ${options.start}-${expectedEnd}`);
  console.log(`Missing: ${toRanges(missing)}`);
  console.log(`Duplicates: ${duplicates.length ? duplicates.map(([index]) => index).join(', ') : 'none'}`);
  console.log(`Unparsed files: ${unparsed.length}`);
  console.log(`Out of range files: ${outOfExpectedRange.length}`);
  console.log(`Filename order issues: ${orderIssues.length}`);

  if (duplicates.length) {
    console.log('\nDuplicate details:');
    for (const [index, list] of duplicates) {
      console.log(`  ${index}:`);
      for (const file of list) console.log(`    ${formatRelative(folder, file)}`);
    }
  }

  if (unparsed.length) {
    console.log('\nUnparsed files:');
    for (const file of unparsed) console.log(`  ${formatRelative(folder, file)}`);
  }

  if (outOfExpectedRange.length) {
    console.log('\nOut of range files:');
    for (const item of outOfExpectedRange) {
      console.log(`  ${item.index}: ${formatRelative(folder, item.file)}`);
    }
  }

  if (orderIssues.length) {
    console.log('\nFilename order issues:');
    for (const [previous, current] of orderIssues) {
      console.log(
        `  ${previous.index} -> ${current.index}: ${formatRelative(folder, previous.file)} | ${formatRelative(folder, current.file)}`
      );
    }
  }

  if (missing.length || duplicates.length || unparsed.length || outOfExpectedRange.length || orderIssues.length) {
    process.exitCode = 2;
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
