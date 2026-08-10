import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const DEFAULT_BASELINE_PATH = '.github/upstream-baseline.json'

function matchesPath(path, rule) {
  return rule.endsWith('/') ? path.startsWith(rule) : path === rule
}

export function validateBaseline(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('upstream baseline must be a JSON object')
  }
  if (value.schema_version !== 1) throw new Error('unsupported upstream baseline schema_version')
  if (typeof value.repository !== 'string' || !value.repository) {
    throw new Error('upstream baseline repository is required')
  }
  if (typeof value.release !== 'string' || !value.release) {
    throw new Error('upstream baseline release is required')
  }
  if (typeof value.commit !== 'string' || !/^[0-9a-f]{40}$/.test(value.commit)) {
    throw new Error('upstream baseline commit must be a lowercase 40-character SHA')
  }
  for (const key of ['allowed_paths', 'immutable_paths']) {
    if (!Array.isArray(value[key]) || value[key].some((item) => typeof item !== 'string' || !item)) {
      throw new Error(`upstream baseline ${key} must be an array of non-empty strings`)
    }
  }
  return value
}

export function evaluateChangedPaths(paths, baseline) {
  return [...new Set(paths)].sort().flatMap((path) => {
    const immutableRule = baseline.immutable_paths.find((rule) => matchesPath(path, rule))
    if (immutableRule) return [`${path} modifies immutable upstream path ${immutableRule}`]
    if (!baseline.allowed_paths.some((rule) => matchesPath(path, rule))) {
      return [`${path} is outside the approved brand overlay`]
    }
    return []
  })
}

function git(args, options = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }).trim()
}

function changedPaths(commit, includeWorktree) {
  const range = includeWorktree ? commit : `${commit}..HEAD`
  const tracked = git(['diff', '--name-only', '--diff-filter=ACDMRTUXB', range, '--'])
    .split('\n')
    .filter(Boolean)
  if (!includeWorktree) return tracked
  const untracked = git(['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean)
  return [...tracked, ...untracked]
}

export function main(argv = process.argv.slice(2)) {
  const includeWorktree = argv.includes('--worktree')
  const unknown = argv.filter((argument) => argument !== '--worktree')
  if (unknown.length) throw new Error(`unknown argument: ${unknown[0]}`)

  const baseline = validateBaseline(JSON.parse(readFileSync(DEFAULT_BASELINE_PATH, 'utf8')))
  git(['cat-file', '-e', `${baseline.commit}^{commit}`])
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', baseline.commit, 'HEAD'], { stdio: 'ignore' })
  } catch {
    throw new Error(`upstream baseline ${baseline.commit} is not an ancestor of HEAD`)
  }

  const paths = changedPaths(baseline.commit, includeWorktree)
  const violations = evaluateChangedPaths(paths, baseline)
  if (violations.length) throw new Error(`upstream boundary violations:\n- ${violations.join('\n- ')}`)

  console.log(
    `upstream boundary OK: ${baseline.repository}@${baseline.release} (${baseline.commit}), ${paths.length} changed paths checked`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
