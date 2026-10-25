import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import {
  isGuardedChangeFile,
  requiredDomainsForFile,
  securityTestReferenceError,
  securityTestReferences,
  validateSystemChangeContract,
} from '../src/systemChangeContract.js';
import { analyzeChangeImpact } from './change-impact-analysis.mjs';

const CONTRACT_PATH = '.github/change-contract.json';
const TEXT_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.json', '.md', '.html', '.css', '.yml', '.yaml', '.txt', '.sh', '.py',
]);
const SYMBOL_DISCOVERY_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.json', '.html', '.css', '.yml', '.yaml',
]);

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf8'));
}

function gitText(args, { allowFailure = false } = {}) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    if (allowFailure) return null;
    const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
    throw new Error(`git ${args.join(' ')} failed${stderr ? `: ${stderr}` : '.'}`);
  }
}

function splitFiles(output) {
  return output.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function uniqueFiles(files) {
  return [...new Set(files.filter(Boolean))];
}

function gitDiffFiles(base, head = 'HEAD') {
  return splitFiles(gitText(['diff', '--name-only', base, head]));
}

function gitRefExists(ref) {
  return gitText(['rev-parse', '--verify', '--quiet', ref], { allowFailure: true }) !== null;
}

function gitWorkingTreeFiles() {
  const unstaged = splitFiles(gitText(['diff', '--name-only', 'HEAD']));
  const staged = splitFiles(gitText(['diff', '--cached', '--name-only']));
  const untracked = splitFiles(gitText(['ls-files', '--others', '--exclude-standard']));
  return uniqueFiles([...unstaged, ...staged, ...untracked]);
}

function resolveLocalBaseRef() {
  const override = process.env.CHANGE_GATE_BASE?.trim();
  if (override) {
    if (!gitRefExists(override)) {
      throw new Error(`CHANGE_GATE_BASE does not resolve to a git ref: ${override}`);
    }
    return override;
  }

  const currentBranch = gitText(['branch', '--show-current'], { allowFailure: true }) ?? '';

  if (currentBranch === 'main') {
    if (gitRefExists('refs/remotes/origin/main')) return 'refs/remotes/origin/main';
    return 'HEAD';
  }

  for (const candidate of ['main', 'refs/remotes/origin/main']) {
    if (gitRefExists(candidate)) return candidate;
  }

  throw new Error(
    'Unable to resolve a local change-gate base. Fetch/create main or set CHANGE_GATE_BASE explicitly.',
  );
}

function changedFilesFromEnvironment() {
  if (process.env.CHANGE_GATE_FILES) {
    return {
      files: uniqueFiles(process.env.CHANGE_GATE_FILES.split(/[,\n]/).map((item) => item.trim())),
      source: 'CHANGE_GATE_FILES',
      baseRef: null,
      headRef: null,
    };
  }

  // Explicit base overrides GitHub push/PR windows. Canonical CI leaves this unset
  // so pull_request uses the PR base SHA and push uses before..after.
  if (process.env.CHANGE_GATE_BASE?.trim()) {
    return changedFilesFromLocalGit();
  }

  const eventName = process.env.GITHUB_EVENT_NAME;
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (!eventName || !eventPath) return null;

  const event = readJson(eventPath);

  if (eventName === 'pull_request') {
    const baseSha = event.pull_request?.base?.sha;
    if (!baseSha) throw new Error('Unable to resolve pull request base SHA.');
    return {
      files: gitDiffFiles(baseSha, 'HEAD'),
      source: `GitHub pull_request base ${baseSha}`,
      baseRef: baseSha,
      headRef: 'HEAD',
    };
  }

  if (eventName === 'push') {
    const before = event.before;
    const after = event.after || 'HEAD';
    const newRef = !before || /^0+$/.test(before);
    return {
      files: newRef ? gitDiffFiles('HEAD^', 'HEAD') : gitDiffFiles(before, after),
      source: `GitHub push ${before || '<new-ref>'}..${after}`,
      baseRef: newRef ? 'HEAD^' : before,
      headRef: after,
    };
  }

  return null;
}

function changedFilesFromLocalGit() {
  const baseRef = resolveLocalBaseRef();
  const committedFiles = [];
  let mergeBase = 'HEAD';

  if (baseRef !== 'HEAD') {
    mergeBase = gitText(['merge-base', baseRef, 'HEAD']);
    committedFiles.push(...gitDiffFiles(mergeBase, 'HEAD'));
  }

  const workingTreeFiles = gitWorkingTreeFiles();
  return {
    files: uniqueFiles([...committedFiles, ...workingTreeFiles]),
    source: `local git diff against ${baseRef} + staged/unstaged/untracked`,
    baseRef: mergeBase,
    headRef: null,
  };
}

function readRepositoryTextFiles() {
  const tracked = splitFiles(gitText(['ls-files']));
  const untracked = splitFiles(gitText(['ls-files', '--others', '--exclude-standard']));
  const files = uniqueFiles([...tracked, ...untracked]);
  const contents = {};

  for (const file of files) {
    const extension = extname(file);
    if (!TEXT_EXTENSIONS.has(extension) && !['Dockerfile', 'Makefile'].includes(file)) continue;
    if (!existsSync(resolve(file))) continue;
    try {
      contents[file] = readFileSync(resolve(file), 'utf8');
    } catch {
      // Binary or unreadable files do not participate in textual/static impact discovery.
    }
  }

  return contents;
}

function buildPatchText(diff, changedFiles) {
  if (!diff.baseRef || changedFiles.length === 0) return '';
  const args = ['diff', '--unified=0', diff.baseRef];
  if (diff.headRef) args.push(diff.headRef);
  args.push('--', ...changedFiles);
  return gitText(args, { allowFailure: true }) ?? '';
}

function isTestPath(path) {
  return path.startsWith('test/') || path.startsWith('tests/') || path.startsWith('e2e/');
}

function missingDeclared(discovered, declared) {
  const declaredSet = new Set(declared ?? []);
  return discovered.filter((item) => !declaredSet.has(item));
}

function printMissing(title, items) {
  if (!items.length) return;
  console.error(title);
  for (const item of items) console.error(`- ${item}`);
}

const contract = readJson(CONTRACT_PATH);
const schemaErrors = validateSystemChangeContract(contract);

if (schemaErrors.length) {
  console.error('System change contract is invalid:');
  for (const error of schemaErrors) console.error(`- ${error}`);
  process.exit(1);
}

const declaredTestFiles = uniqueFiles([
  ...(contract.tests?.targeted ?? []),
  ...(contract.tests?.e2e?.targeted ?? []),
]);
const missingDeclaredTestFiles = declaredTestFiles.filter((path) => !existsSync(resolve(path)));
if (missingDeclaredTestFiles.length) {
  console.error('Declared regression/E2E test files do not exist:');
  for (const path of missingDeclaredTestFiles) console.error(`- ${path}`);
  process.exit(1);
}

const readRepositoryText = (path) => {
  const absolute = resolve(path);
  if (!existsSync(absolute)) return null;
  try {
    return readFileSync(absolute, 'utf8');
  } catch {
    return null;
  }
};
const brokenSecurityTests = securityTestReferences(contract)
  .map(({ id, index, reference }) => {
    const problem = securityTestReferenceError(reference, readRepositoryText);
    return problem ? `security.controls.${id}.tests[${index}] ${problem}` : null;
  })
  .filter(Boolean);
if (brokenSecurityTests.length) {
  console.error('Security control test references do not resolve:');
  for (const problem of brokenSecurityTests) console.error(`- ${problem}`);
  process.exit(1);
}

let diff;
try {
  diff = changedFilesFromEnvironment() ?? changedFilesFromLocalGit();
} catch (error) {
  console.error(`Unable to enforce the system change contract diff: ${error.message}`);
  process.exit(1);
}

const changedFiles = diff.files;
console.log(`Diff source: ${diff.source}`);

const guardedFiles = changedFiles.filter(isGuardedChangeFile);
if (guardedFiles.length === 0) {
  console.log('No guarded system files changed.');
  process.exit(0);
}

if (!changedFiles.includes(CONTRACT_PATH)) {
  console.error(`Guarded files changed but ${CONTRACT_PATH} was not updated.`);
  console.error('Declare the change impact before implementation is accepted.');
  for (const file of guardedFiles) console.error(`- ${file}`);
  process.exit(1);
}

const requiredDomains = new Set();
for (const file of guardedFiles) {
  for (const domain of requiredDomainsForFile(file)) requiredDomains.add(domain);
}

const undeclaredRequiredDomains = [...requiredDomains]
  .filter((domain) => contract.impact?.[domain] !== 'affected');

if (undeclaredRequiredDomains.length) {
  console.error('Changed high-risk paths require these impact domains to be marked affected:');
  for (const domain of undeclaredRequiredDomains) console.error(`- ${domain}`);
  process.exit(1);
}

let discovered;
try {
  const fileContents = readRepositoryTextFiles();
  delete fileContents[CONTRACT_PATH];
  const symbolDiscoveryFiles = guardedFiles.filter((file) => (
    !isTestPath(file)
    && SYMBOL_DISCOVERY_EXTENSIONS.has(extname(file))
  ));
  const referenceDiscoveryFiles = uniqueFiles([
    ...symbolDiscoveryFiles,
    ...guardedFiles.filter((file) => file.startsWith('public/')),
  ]);
  const patchText = buildPatchText(diff, symbolDiscoveryFiles);
  discovered = analyzeChangeImpact({
    changedFiles: guardedFiles,
    tokenFiles: symbolDiscoveryFiles,
    referenceFiles: referenceDiscoveryFiles,
    fileContents,
    patchText,
  });
} catch (error) {
  console.error(`Unable to complete full-system impact discovery: ${error.message}`);
  process.exit(1);
}

const missingFiles = missingDeclared(discovered.affectedFiles, contract.impactAnalysis.affectedFiles);
const missingTests = missingDeclared(discovered.affectedTests, contract.impactAnalysis.affectedTests);
const missingDocs = missingDeclared(discovered.affectedDocs, contract.impactAnalysis.affectedDocs);
const reviewedFindings = [
  ...contract.impactAnalysis.relatedFindings.affected,
  ...contract.impactAnalysis.relatedFindings.reviewedNotAffected,
];
const missingFindings = missingDeclared(discovered.candidateFindings, reviewedFindings);

if (missingFiles.length || missingTests.length || missingDocs.length || missingFindings.length) {
  console.error('Full-system impact sweep found undeclared affected/review surfaces.');
  printMissing('Code/runtime dependents missing from impactAnalysis.affectedFiles:', missingFiles);
  printMissing('Existing tests missing from impactAnalysis.affectedTests:', missingTests);
  printMissing('Docs/contracts missing from impactAnalysis.affectedDocs:', missingDocs);
  printMissing('Candidate findings not reviewed in impactAnalysis.relatedFindings:', missingFindings);
  if (discovered.tokens.length) console.error(`Discovery tokens: ${discovered.tokens.join(', ')}`);
  process.exit(1);
}

console.log(`Change contract accepted: ${contract.id}`);
console.log(`Guarded files: ${guardedFiles.length}`);
if (requiredDomains.size) console.log(`Path-required domains: ${[...requiredDomains].join(', ')}`);
console.log(`Impact sweep: ${discovered.affectedFiles.length} code dependents, ${discovered.affectedTests.length} tests, ${discovered.affectedDocs.length} docs, ${discovered.candidateFindings.length} finding candidates reviewed.`);
if (contract.tests.e2e.required) {
  console.log(`E2E required: ${contract.tests.e2e.targeted.join(', ')}`);
} else {
  console.log(`E2E not required: ${contract.tests.e2e.reason}`);
}
