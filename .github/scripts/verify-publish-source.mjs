import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const BRAND_REF = 'refs/remotes/origin/zero-one/brand'

export function validateCommitSha(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/.test(value)) {
    throw new Error('commit_sha must be a lowercase 40-character SHA')
  }
  return value
}

export function findSuccessfulRun(payload, commitSha) {
  const runs = Array.isArray(payload?.workflow_runs) ? payload.workflow_runs : []
  return runs
    .filter((run) => run?.head_sha === commitSha && run?.status === 'completed' && run?.conclusion === 'success')
    .sort((left, right) => String(right.updated_at).localeCompare(String(left.updated_at)))[0]
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function requireCommitOnBrand(commitSha) {
  git(['cat-file', '-e', `${commitSha}^{commit}`])
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', commitSha, BRAND_REF], { stdio: 'ignore' })
  } catch {
    throw new Error(`${commitSha} is not part of origin/zero-one/brand`)
  }
  git(['cat-file', '-e', `${commitSha}:.github/upstream-baseline.json`])
  git(['cat-file', '-e', `${commitSha}:.github/scripts/verify-upstream-boundary.mjs`])
  git(['cat-file', '-e', `${commitSha}:.github/workflows/zero-one-ci.yml`])
}

async function fetchSuccessfulRun(repository, token, commitSha) {
  if (!repository || !token) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required')
  const url = new URL(
    `https://api.github.com/repos/${repository}/actions/workflows/zero-one-ci.yml/runs`,
  )
  url.searchParams.set('head_sha', commitSha)
  url.searchParams.set('status', 'completed')
  url.searchParams.set('per_page', '100')

  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`GitHub Actions lookup failed with HTTP ${response.status}`)

  const run = findSuccessfulRun(await response.json(), commitSha)
  if (!run) throw new Error(`Zero One CI has no successful completed run for ${commitSha}`)
  return run
}

export async function main(env = process.env) {
  const commitSha = validateCommitSha(env.COMMIT_SHA)
  requireCommitOnBrand(commitSha)
  const run = await fetchSuccessfulRun(env.GITHUB_REPOSITORY, env.GITHUB_TOKEN, commitSha)

  if (env.GITHUB_OUTPUT) {
    appendFileSync(env.GITHUB_OUTPUT, `source_sha=${commitSha}\nci_run_url=${run.html_url}\n`)
  }
  console.log(`publish source OK: ${commitSha}, Zero One CI ${run.html_url}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
