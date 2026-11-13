import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { lookup } from 'node:dns/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(projectRoot, 'tools/skills/manifest.json'), 'utf8'));
const skillRoots = [
  join(projectRoot, '.agents/skills'),
  join(projectRoot, '.codex/skills'),
  join(homedir(), '.agents/skills'),
  join(homedir(), '.codex/skills'),
];

function hasEmbeddedSection(text, heading) {
  // Ignore example headings inside fenced code blocks.
  const lines = text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, '').split(/\r?\n/);
  const start = lines.findIndex(line => line.trim() === `## ${heading}`);
  if (start < 0) return false;
  const remaining = lines.slice(start + 1);
  const next = remaining.findIndex(line => /^#{1,2}\s+/.test(line));
  const body = next < 0 ? remaining : remaining.slice(0, next);
  return body.some(line => !/^\s*#/.test(line) && /[a-zA-Z]/.test(line));
}

export function statusOf(skill, roots = skillRoots) {
  // An incomplete project copy must not be hidden by a global copy.
  for (const root of roots) {
    const directory = join(root, skill.name);
    if (!existsSync(directory)) continue;
    const missing = skill.requiredPaths.filter(path => !existsSync(join(directory, path)));
    const skillFile = join(directory, 'SKILL.md');
    const text = existsSync(skillFile) ? readFileSync(skillFile, 'utf8') : '';
    for (const reference of skill.referenceAlternatives ?? []) {
      const referenceFile = join(directory, reference.file);
      const externalContent = existsSync(referenceFile) && readFileSync(referenceFile, 'utf8').trim().length > 0;
      // A template that explicitly points to an external file still needs it.
      const embeddedContent = !text.includes(reference.file) && hasEmbeddedSection(text, reference.embeddedHeading);
      if (!externalContent && !embeddedContent) {
        missing.push(`${reference.file} or embedded section: ${reference.embeddedHeading}`);
      }
    }
    const escapedName = skill.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const headerValid = /^---\r?\n/.test(text)
      && new RegExp(`^name:\\s*["']?${escapedName}["']?\\s*$`, 'm').test(text);
    return {
      name: skill.name,
      status: missing.length === 0 && headerValid ? 'Ready' : 'Incomplete',
      path: directory,
      missing,
      headerValid,
      skillFileSha256: text ? createHash('sha256').update(text).digest('hex') : null,
    };
  }
  return { name: skill.name, status: 'Missing', path: '', missing: ['SKILL.md'], headerValid: false };
}

function printStatuses(statuses) {
  console.table(statuses.map(({ name, status, missing }) => ({ name, status, missing: missing.join(', ') })));
}

function validateManifest() {
  if (manifest.schemaVersion !== 1 || new Set(manifest.skills.map(s => s.name)).size !== manifest.skills.length) {
    throw new Error('Invalid manifest schema or duplicate skill names.');
  }
  for (const skill of manifest.skills) {
    if (!/^[a-z0-9-]+$/.test(skill.name) || !/^[\w.-]+\/[\w.-]+$/.test(skill.repository)) {
      throw new Error('Invalid skill name or repository.');
    }
    if (!['skills', 'ui-ux-pro-max-cli'].includes(skill.installer)) {
      throw new Error('Unsupported installer.');
    }
    const verificationPaths = [...skill.requiredPaths, ...(skill.referenceAlternatives ?? []).map(r => r.file)];
    if (!skill.requiredPaths.includes('SKILL.md') || verificationPaths.some(p =>
      typeof p !== 'string' || p.startsWith('/') || p.includes('\\') || p.includes(':') || p.split('/').includes('..'))) {
      throw new Error('Verification paths must remain inside each skill directory.');
    }
    if ((skill.referenceAlternatives ?? []).some(r => typeof r.embeddedHeading !== 'string' || !r.embeddedHeading.trim())) {
      throw new Error('Reference alternatives must specify an embedded section heading.');
    }
  }
}

function findNpxCli() {
  // Invoke npm's JavaScript entrypoint directly, without a shell or .ps1 policy.
  const candidates = [
    join(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js'),
    resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npx-cli.js'),
  ];
  const found = candidates.find(path => existsSync(path));
  if (!found) throw new Error('Cannot locate npm/npx next to Node.js. Use the direct commands in docs/SKILLS.md.');
  return found;
}

async function main() {
  validateManifest();
  const flags = process.argv.slice(2);
  if (flags.some(flag => !['--plan', '--verify'].includes(flag)) || flags.length > 1) {
    throw new Error('Usage: node scripts/install-skills.mjs [--plan | --verify]');
  }
  const initialStatuses = manifest.skills.map(skill => statusOf(skill));
  if (flags.includes('--plan')) {
    for (const skill of manifest.skills) console.log(`${skill.name} (${skill.repository}): ${skill.purpose}`);
    printStatuses(initialStatuses);
    return;
  }

  if (flags.includes('--verify')) {
    printStatuses(initialStatuses);
    const unready = initialStatuses.filter(s => s.status !== 'Ready');
    if (unready.length) throw new Error(`${unready.length} skill(s) missing or incomplete. No files were changed.`);
    console.log('Required files verified. Browser/test dependencies are checked separately.');
    return;
  }

  if (initialStatuses.every(status => status.status === 'Ready')) {
    printStatuses(initialStatuses);
    writeReport(initialStatuses, []);
    console.log('All selected skills are already available. No downloads needed.');
    return;
  }

  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 20)) {
    throw new Error('The current Skills CLI requires Node.js 22.20 or later.');
  }
  const npxCli = findNpxCli();
  for (const command of ['git', 'python']) {
    const result = spawnSync(command, ['--version'], { encoding: 'utf8', windowsHide: true });
    if (result.error || result.status !== 0) throw new Error(`Missing prerequisite: ${command}. Install it separately.`);
  }
  for (const hostname of ['registry.npmjs.org', 'github.com']) {
    try { await lookup(hostname); }
    catch { throw new Error(`Cannot resolve ${hostname}. Installation has not started; check terminal network access.`); }
  }

  const errors = [];
  const pending = manifest.skills.filter(skill => {
    const status = statusOf(skill);
    if (status.status === 'Ready') console.log(`Already available: ${skill.name}`);
    if (status.status === 'Incomplete') errors.push(`${skill.name}: existing incomplete copy at ${status.path}; not overwritten.`);
    return status.status === 'Missing';
  });
  const groups = new Map();
  for (const skill of pending.filter(s => s.installer === 'skills')) {
    const names = groups.get(skill.repository) ?? [];
    names.push(skill.name);
    groups.set(skill.repository, names);
  }
  function install(args) {
    console.log(`npx ${args.join(' ')}`);
    const result = spawnSync(process.execPath, [npxCli, ...args], {
      cwd: projectRoot,
      stdio: 'inherit',
      windowsHide: true,
      env: { ...process.env, DISABLE_TELEMETRY: '1', npm_config_fetch_retries: '0', npm_config_fetch_timeout: '20000' },
    });
    if (result.error || result.status !== 0) {
      errors.push(`${args.slice(0, 4).join(' ')}: ${result.error?.message ?? `exit ${result.status}`}`);
    }
  }
  for (const [repository, names] of groups) {
    install(['--yes', 'skills', 'add', `https://github.com/${repository}`, '--skill', ...names, '--agent', 'codex', '--copy', '--yes']);
  }
  // The official UI/UX installer materializes its engine, references and CSVs.
  for (const skill of pending.filter(s => s.installer === 'ui-ux-pro-max-cli')) {
    install(['--yes', skill.installer, 'init', '--ai', 'codex']);
  }

  const statuses = manifest.skills.map(skill => statusOf(skill));
  printStatuses(statuses);
  writeReport(statuses, errors);
  const unready = statuses.filter(s => s.status !== 'Ready');
  if (errors.length || unready.length) {
    for (const error of errors) console.error(error);
    throw new Error(`Installation incomplete: ${unready.length} skill(s) require attention. See tmp/skills-install-report.json.`);
  }
  console.log('Installation verified. New skills will be available on your next turn; reopen the session if needed.');
}

function writeReport(statuses, errors) {
  mkdirSync(join(projectRoot, 'tmp'), { recursive: true });
  writeFileSync(join(projectRoot, 'tmp/skills-install-report.json'), JSON.stringify({ checkedAt: new Date().toISOString(), skills: statuses, errors }, null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
