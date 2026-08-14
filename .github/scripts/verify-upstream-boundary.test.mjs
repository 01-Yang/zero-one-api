import assert from 'node:assert/strict'
import { lstatSync, readFileSync } from 'node:fs'
import test from 'node:test'
import {
  evaluateApprovedBackportContents,
  evaluateChangedPaths,
  validateBaseline,
} from './verify-upstream-boundary.mjs'

const baseline = validateBaseline(
  JSON.parse(readFileSync(new URL('../upstream-baseline.json', import.meta.url), 'utf8')),
)
const repositoryRoot = new URL('../../', import.meta.url)

function readRepositoryPath(path) {
  const url = new URL(path, repositoryRoot)
  const stat = lstatSync(url)
  return {
    content: readFileSync(url),
    isRegularFile: stat.isFile(),
    mode: stat.mode & 0o111 ? '100755' : '100644',
  }
}

const approvedBackendHotfixPaths = [
  'backend/internal/handler/admin/admin_basic_handlers_test.go',
  'backend/internal/handler/admin/admin_service_stub_test.go',
  'backend/internal/handler/admin/group_handler.go',
  'backend/internal/repository/api_key_repo_profit_projection_integration_test.go',
  'backend/internal/repository/auth_cache_invalidation_profit_integration_test.go',
  'backend/internal/repository/migrations_schema_integration_test.go',
  'backend/internal/service/admin_group.go',
  'backend/internal/service/admin_group_duplicate.go',
  'backend/internal/service/admin_group_duplicate_test.go',
  'backend/internal/service/admin_group_model_pricing_test.go',
  'backend/internal/service/api_key_auth_cache.go',
  'backend/internal/service/api_key_auth_cache_group_pricing_test.go',
  'backend/internal/service/api_key_auth_cache_impl.go',
  'backend/internal/service/api_key_auth_cache_profit_test.go',
  'backend/internal/service/api_key_service_cache_test.go',
  'backend/internal/service/batch_image_public.go',
  'backend/internal/service/batch_image_public_test.go',
  'backend/internal/service/billing_service.go',
  'backend/internal/service/billing_service_test.go',
  'backend/internal/service/billing_service_unified_test.go',
  'backend/internal/service/channel_plaza.go',
  'backend/internal/service/channel_plaza_test.go',
  'backend/internal/service/model_pricing_resolver.go',
  'backend/internal/service/openai_alpha_search_billing_test.go',
  'backend/internal/service/openai_gateway_record_usage_test.go',
  'backend/internal/service/openai_gateway_search_surcharge_test.go',
  'backend/internal/service/openai_gateway_usage.go',
  'backend/internal/service/response_model_billing_test.go',
  'backend/migrations/222_group_pricing_auth_cache_invalidation.sql',
  'backend/migrations/group_pricing_auth_cache_migration_test.go',
].sort()

test('allows the additive brand surfaces', () => {
  assert.deepEqual(
    evaluateChangedPaths(
      [
        '.github/workflows/zero-one-publish.yml',
        'README.md',
        'deploy/zero-one/compose.yml',
        'frontend/src/style.css',
        'landing/src/App.tsx',
      ],
      baseline,
    ),
    [],
  )
})

test('allows only the exact reviewed backend production-correctness hotfixes', () => {
  assert.deepEqual(evaluateChangedPaths(approvedBackendHotfixPaths, baseline), [])
  assert.deepEqual(
    baseline.allowed_paths.filter((path) => path.startsWith('backend/')).sort(),
    approvedBackendHotfixPaths,
  )
})

test('rejects adjacent backend and unrelated upstream changes', () => {
  assert.deepEqual(
    evaluateChangedPaths(
      [
        'backend/internal/service/channel.go',
        'backend/migrations/223_unreviewed.sql',
        'frontend/src/views/user/PaymentView.vue',
      ],
      baseline,
    ),
    [
      'backend/internal/service/channel.go is outside the approved brand overlay',
      'backend/migrations/223_unreviewed.sql is outside the approved brand overlay',
      'frontend/src/views/user/PaymentView.vue is outside the approved brand overlay',
    ],
  )
})

test('rejects immutable frontend contracts inside the otherwise allowed frontend', () => {
  assert.deepEqual(
    evaluateChangedPaths(
      ['frontend/src/api/client.ts', 'frontend/src/types/index.ts', 'frontend/vite.config.ts'],
      baseline,
    ),
    [
      'frontend/src/api/client.ts modifies immutable upstream path frontend/src/api/',
      'frontend/src/types/index.ts modifies immutable upstream path frontend/src/types/',
      'frontend/vite.config.ts modifies immutable upstream path frontend/vite.config.ts',
    ],
  )
})

test('allows only exact-content upstream security backports', () => {
  const approvedPaths = baseline.approved_backports.flatMap((backport) => Object.keys(backport.files))

  assert.deepEqual(evaluateChangedPaths(approvedPaths, baseline), [])
  assert.deepEqual(evaluateApprovedBackportContents(baseline, readRepositoryPath), [])
  assert.ok(baseline.immutable_paths.includes('frontend/pnpm-lock.yaml'))
  assert.ok(!baseline.allowed_paths.includes('frontend/pnpm-lock.yaml'))
})

test('rejects changed, missing, and non-regular approved backport files', () => {
  const changed = evaluateApprovedBackportContents(baseline, (path) => {
    const file = readRepositoryPath(path)
    return path === 'frontend/pnpm-lock.yaml'
      ? { ...file, content: Buffer.concat([file.content, Buffer.from('\n')]) }
      : file
  })
  assert.equal(changed.length, 1)
  assert.match(changed[0], /frontend\/pnpm-lock\.yaml content mismatch/)

  const missing = evaluateApprovedBackportContents(baseline, (path) => {
    if (path === 'backend/go.mod') throw new Error('missing')
    return readRepositoryPath(path)
  })
  assert.deepEqual(missing, ['approved backport backend/go.mod is missing'])

  const nonRegular = evaluateApprovedBackportContents(baseline, (path) => {
    const file = readRepositoryPath(path)
    return path === 'Dockerfile' ? { ...file, isRegularFile: false } : file
  })
  assert.deepEqual(nonRegular, ['approved backport Dockerfile is not a regular file'])

  const executable = evaluateApprovedBackportContents(baseline, (path) => {
    const file = readRepositoryPath(path)
    return path === 'Dockerfile' ? { ...file, mode: '100755' } : file
  })
  assert.deepEqual(executable, [
    'approved backport Dockerfile mode mismatch: expected 100644, got 100755',
  ])
})

test('rejects stale or malformed approved backport metadata', () => {
  const clone = () => structuredClone(baseline)

  const stale = clone()
  stale.release = 'v0.1.177'
  assert.throws(() => validateBaseline(stale), /valid_for_release must match/)

  const wrongRepository = clone()
  wrongRepository.approved_backports[0].source_repository = 'example/other'
  assert.throws(() => validateBaseline(wrongRepository), /source_repository must match/)

  const badPullRequest = clone()
  badPullRequest.approved_backports[0].source_pull_request = 0
  assert.throws(() => validateBaseline(badPullRequest), /source_pull_request must be a positive integer/)

  const badCommit = clone()
  badCommit.approved_backports[0].source_commit = 'ABC'
  assert.throws(() => validateBaseline(badCommit), /source_commit must be a lowercase 40-character SHA/)

  const badHash = clone()
  badHash.approved_backports[0].files['backend/go.mod'].sha256 = '0'
  assert.throws(() => validateBaseline(badHash), /sha256 is invalid: backend\/go\.mod/)

  const badMode = clone()
  badMode.approved_backports[0].files['backend/go.mod'].mode = '100600'
  assert.throws(() => validateBaseline(badMode), /mode is invalid: backend\/go\.mod/)

  const duplicate = clone()
  duplicate.approved_backports.push(structuredClone(duplicate.approved_backports[0]))
  assert.throws(() => validateBaseline(duplicate), /duplicate approved backport path/)

  const traversal = clone()
  traversal.approved_backports[0].files['../backend/go.mod'] = {
    sha256: '0'.repeat(64),
    mode: '100644',
  }
  assert.throws(() => validateBaseline(traversal), /approved backport path is invalid/)

  const alreadyAllowed = clone()
  alreadyAllowed.approved_backports[0].files['README.md'] = {
    sha256: '0'.repeat(64),
    mode: '100644',
  }
  assert.throws(() => validateBaseline(alreadyAllowed), /already allowed by the brand overlay/)
})
