#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const stableReleasePattern = /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u

function git(args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function matchesPath(path, rule) {
  return rule.endsWith('/') ? path.startsWith(rule) : path === rule
}

export function parseArguments(argv) {
  const options = { worktree: false }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--worktree') {
      options.worktree = true
      continue
    }
    if (argument === '--old-ref' || argument === '--new-ref') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`)
      options[argument === '--old-ref' ? 'oldRef' : 'newRef'] = value
      index += 1
      continue
    }
    throw new Error(`unknown argument: ${argument}`)
  }

  if (!stableReleasePattern.test(options.oldRef || '')) {
    throw new Error('--old-ref must be a stable vMAJOR.MINOR.PATCH tag')
  }
  if (!stableReleasePattern.test(options.newRef || '')) {
    throw new Error('--new-ref must be a stable vMAJOR.MINOR.PATCH tag')
  }
  if (options.oldRef === options.newRef) throw new Error('old and new release tags must differ')
  return options
}

export function classifyUIPaths(paths, manifest) {
  const unique = [...new Set(paths)].sort()
  const compatibility = unique.filter((path) =>
    manifest.compatibility_paths.some((rule) => matchesPath(path, rule)),
  )
  const protectedPaths = unique.filter(
    (path) =>
      manifest.protected_paths.some((rule) => matchesPath(path, rule)) &&
      !manifest.compatibility_paths.some((rule) => matchesPath(path, rule)),
  )
  return { compatibility, protected: protectedPaths }
}

export function evaluateDirtyPreflight(statusLines) {
  const paths = statusLines
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
  return paths.length === 0
    ? []
    : [`worktree must be isolated before upgrade verification: ${paths.sort().join(', ')}`]
}

export function evaluatePinnedRelease({ newRef, newCommit, baseline }) {
  const violations = []
  if (newRef !== baseline.release) {
    violations.push(`new release ${newRef} does not match baseline release ${baseline.release}`)
  }
  if (newCommit !== baseline.commit) {
    violations.push(`new release ${newRef} peels to ${newCommit}, expected ${baseline.commit}`)
  }
  return violations
}

export function evaluateHotfixAudit(hotfixes, upstreamChangedPaths, matchesUpstreamPaths = []) {
  const changed = new Set(upstreamChangedPaths)
  const matchesUpstream = new Set(matchesUpstreamPaths)
  return hotfixes.map((hotfix) => {
    const overlaps = hotfix.paths.filter((path) => changed.has(path)).sort()
    const exitCandidates = hotfix.paths.filter((path) => matchesUpstream.has(path)).sort()
    return {
      name: hotfix.name,
      status: exitCandidates.length > 0 ? 'exit-required' : overlaps.length > 0 ? 'reviewed-overlap' : 'retained',
      overlaps,
      exit_candidates: exitCandidates,
    }
  })
}

function runAdapter(name, command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return {
    name,
    ok: result.status === 0,
    output: [result.stdout, result.stderr]
      .filter(Boolean)
      .join('\n')
      .trim(),
  }
}

function matchingUpstreamHotfixPaths(hotfixes, newCommit) {
  return hotfixes
    .flatMap((hotfix) => hotfix.paths)
    .filter((path) => {
      const result = spawnSync('git', ['diff', '--quiet', newCommit, 'HEAD', '--', path], {
        cwd: repoRoot,
        stdio: 'ignore',
      })
      return result.status === 0
    })
}

function printResult(result, stream = process.stdout) {
  stream.write(`${JSON.stringify(result, null, 2)}\n`)
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv)
  const baseline = JSON.parse(readFileSync(resolve(repoRoot, '.github/upstream-baseline.json'), 'utf8'))
  const uiManifest = JSON.parse(readFileSync(resolve(repoRoot, '.github/scripts/ui-baseline.json'), 'utf8'))
  const oldCommit = git(['rev-parse', '--verify', `${options.oldRef}^{commit}`])
  const newCommit = git(['rev-parse', '--verify', `${options.newRef}^{commit}`])
  const changedOutput = git([
    'diff',
    '--no-renames',
    '--name-only',
    '--diff-filter=ACDMRTUXB',
    oldCommit,
    newCommit,
    '--',
  ])
  const upstreamChangedPaths = changedOutput ? changedOutput.split(/\r?\n/u).filter(Boolean) : []
  const uiChanges = classifyUIPaths(upstreamChangedPaths, uiManifest)
  const statusOutput = git(['status', '--porcelain=v1', '--untracked-files=all'])
  const preflightViolations = evaluateDirtyPreflight(
    statusOutput ? statusOutput.split(/\r?\n/u) : [],
  )
  const pinnedViolations = evaluatePinnedRelease({
    newRef: options.newRef,
    newCommit,
    baseline,
  })
  const hotfixAudit = evaluateHotfixAudit(
    baseline.legacy_hotfixes,
    upstreamChangedPaths,
    matchingUpstreamHotfixPaths(baseline.legacy_hotfixes, newCommit),
  )
  const exitCandidates = hotfixAudit.flatMap((hotfix) => hotfix.exit_candidates)
  const adapterArgs = options.worktree ? ['--worktree'] : []
  const adapters = [
    runAdapter(
      'upstream-boundary',
      process.execPath,
      ['.github/scripts/verify-upstream-boundary.mjs', ...adapterArgs],
    ),
    runAdapter(
      'ui-boundary',
      process.execPath,
      ['.github/scripts/verify-ui-boundary.mjs', ...adapterArgs],
    ),
    runAdapter('recovered-console-contract', 'sh', ['deploy/zero-one/test-routing.sh']),
  ]
  const violations = [
    ...preflightViolations,
    ...pinnedViolations,
    ...exitCandidates.map((path) => `legacy hotfix matches upstream and must exit: ${path}`),
    ...adapters.filter((adapter) => !adapter.ok).map((adapter) => `${adapter.name} failed`),
  ]
  const result = {
    verdict: violations.length === 0 ? 'PASS' : 'FAIL',
    releases: {
      old_ref: options.oldRef,
      old_commit: oldCommit,
      new_ref: options.newRef,
      new_commit: newCommit,
    },
    worktree: {
      included_in_adapters: options.worktree,
      clean: preflightViolations.length === 0,
    },
    upstream_changes: {
      total: upstreamChangedPaths.length,
      protected_ui: uiChanges.protected,
      compatibility_ui: uiChanges.compatibility,
    },
    legacy_hotfixes: hotfixAudit,
    adapters,
    violations,
  }
  printResult(result, violations.length === 0 ? process.stdout : process.stderr)
  if (violations.length > 0) process.exitCode = 1
  return result
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    printResult(
      {
        verdict: 'FAIL',
        violations: [error instanceof Error ? error.message : String(error)],
      },
      process.stderr,
    )
    process.exitCode = 1
  }
}
