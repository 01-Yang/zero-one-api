import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const DEFAULT_BASELINE_PATH = '.github/upstream-baseline.json'

function matchesPath(path, rule) {
  return rule.endsWith('/') ? path.startsWith(rule) : path === rule
}

export function validateBaseline(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('upstream baseline must be a JSON object')
  }
  if (value.schema_version !== 2) throw new Error('unsupported upstream baseline schema_version')
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

  if (!Array.isArray(value.approved_backports)) {
    throw new Error('upstream baseline approved_backports must be an array')
  }

  const approvedPaths = new Set()
  for (const backport of value.approved_backports) {
    if (!backport || typeof backport !== 'object' || Array.isArray(backport)) {
      throw new Error('approved backport must be an object')
    }
    if (backport.source_repository !== value.repository) {
      throw new Error('approved backport source_repository must match the baseline repository')
    }
    if (!Number.isSafeInteger(backport.source_pull_request) || backport.source_pull_request <= 0) {
      throw new Error('approved backport source_pull_request must be a positive integer')
    }
    if (typeof backport.source_commit !== 'string' || !/^[0-9a-f]{40}$/.test(backport.source_commit)) {
      throw new Error('approved backport source_commit must be a lowercase 40-character SHA')
    }
    if (backport.valid_for_release !== value.release) {
      throw new Error('approved backport valid_for_release must match the baseline release')
    }
    if (typeof backport.exit_condition !== 'string' || !backport.exit_condition.trim()) {
      throw new Error('approved backport exit_condition is required')
    }
    if (
      !backport.files ||
      typeof backport.files !== 'object' ||
      Array.isArray(backport.files) ||
      Object.keys(backport.files).length === 0
    ) {
      throw new Error('approved backport files must be a non-empty object')
    }

    for (const [path, file] of Object.entries(backport.files)) {
      if (
        !path ||
        path.startsWith('/') ||
        path.endsWith('/') ||
        path.includes('\\') ||
        path.split('/').some((part) => part === '.' || part === '..')
      ) {
        throw new Error(`approved backport path is invalid: ${path || '<empty>'}`)
      }
      if (approvedPaths.has(path)) throw new Error(`duplicate approved backport path: ${path}`)
      if (!file || typeof file !== 'object' || Array.isArray(file)) {
        throw new Error(`approved backport file metadata is invalid: ${path}`)
      }
      if (typeof file.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(file.sha256)) {
        throw new Error(`approved backport sha256 is invalid: ${path}`)
      }
      if (file.mode !== '100644' && file.mode !== '100755') {
        throw new Error(`approved backport mode is invalid: ${path}`)
      }
      const immutableRule = value.immutable_paths.find((rule) => matchesPath(path, rule))
      const allowedRule = value.allowed_paths.find((rule) => matchesPath(path, rule))
      if (!immutableRule && allowedRule) {
        throw new Error(`approved backport path is already allowed by the brand overlay: ${path}`)
      }
      approvedPaths.add(path)
    }
  }
  return value
}

function approvedBackportFiles(baseline) {
  return new Map(
    baseline.approved_backports.flatMap((backport) =>
      Object.entries(backport.files).map(([path, file]) => [path, file]),
    ),
  )
}

export function evaluateChangedPaths(paths, baseline) {
  const backportFiles = approvedBackportFiles(baseline)
  return [...new Set(paths)].sort().flatMap((path) => {
    if (backportFiles.has(path)) return []
    const immutableRule = baseline.immutable_paths.find((rule) => matchesPath(path, rule))
    if (immutableRule) return [`${path} modifies immutable upstream path ${immutableRule}`]
    if (!baseline.allowed_paths.some((rule) => matchesPath(path, rule))) {
      return [`${path} is outside the approved brand overlay`]
    }
    return []
  })
}

export function evaluateApprovedBackportContents(baseline, readPath) {
  const violations = []
  for (const [path, expected] of approvedBackportFiles(baseline)) {
    let file
    try {
      file = readPath(path)
    } catch {
      violations.push(`approved backport ${path} is missing`)
      continue
    }
    if (!file?.isRegularFile) {
      violations.push(`approved backport ${path} is not a regular file`)
      continue
    }
    if (file.mode !== expected.mode) {
      violations.push(
        `approved backport ${path} mode mismatch: expected ${expected.mode}, got ${file.mode}`,
      )
      continue
    }
    const actualSha256 = createHash('sha256').update(file.content).digest('hex')
    if (actualSha256 !== expected.sha256) {
      violations.push(
        `approved backport ${path} content mismatch: expected ${expected.sha256}, got ${actualSha256}`,
      )
    }
  }
  return violations
}

function git(args, options = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }).trim()
}

function readHeadPath(path) {
  const entry = git(['ls-tree', 'HEAD', '--', path])
  if (!entry) throw new Error(`missing ${path}`)
  const mode = entry.split(/\s+/, 1)[0]
  return {
    content: execFileSync('git', ['show', `HEAD:${path}`], { stdio: ['ignore', 'pipe', 'pipe'] }),
    isRegularFile: mode === '100644' || mode === '100755',
    mode,
  }
}

function readWorktreePath(path) {
  const stat = lstatSync(path)
  if (!stat.isFile()) return { content: Buffer.alloc(0), isRegularFile: false, mode: null }
  return {
    content: readFileSync(path),
    isRegularFile: true,
    mode: stat.mode & 0o111 ? '100755' : '100644',
  }
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

  const baselineSource = includeWorktree
    ? readFileSync(DEFAULT_BASELINE_PATH, 'utf8')
    : git(['show', `HEAD:${DEFAULT_BASELINE_PATH}`])
  const baseline = validateBaseline(JSON.parse(baselineSource))
  git(['cat-file', '-e', `${baseline.commit}^{commit}`])
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', baseline.commit, 'HEAD'], { stdio: 'ignore' })
  } catch {
    throw new Error(`upstream baseline ${baseline.commit} is not an ancestor of HEAD`)
  }

  const paths = changedPaths(baseline.commit, includeWorktree)
  const readPath = includeWorktree ? readWorktreePath : readHeadPath
  const violations = [
    ...evaluateChangedPaths(paths, baseline),
    ...evaluateApprovedBackportContents(baseline, readPath),
  ]
  if (violations.length) throw new Error(`upstream boundary violations:\n- ${violations.join('\n- ')}`)

  console.log(
    `upstream boundary OK: ${baseline.repository}@${baseline.release} (${baseline.commit}), ${paths.length} changed paths checked, ${approvedBackportFiles(baseline).size} exact backports verified`,
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
