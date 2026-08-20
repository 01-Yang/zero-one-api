import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync } from 'node:fs'
import test from 'node:test'
import {
  evaluateApprovedBackportContents,
  evaluateChangedPaths,
  evaluateReleaseTag,
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

function baselineWithApprovedBackport() {
  const value = structuredClone(baseline)
  const files = {}
  for (const path of ['Dockerfile', 'backend/Dockerfile', 'deploy/Dockerfile']) {
    const file = readRepositoryPath(path)
    files[path] = {
      sha256: createHash('sha256').update(file.content).digest('hex'),
      mode: file.mode,
    }
  }
  value.approved_backports = [
    {
      source_repository: value.repository,
      source_pull_request: 5639,
      source_commit: 'f'.repeat(40),
      valid_for_release: value.release,
      exit_condition:
        'Remove when the first stable upstream release containing the equivalent change becomes the baseline.',
      files,
    },
  ]
  return validateBaseline(value)
}

const approvedLegacyHotfixPaths = [
  'backend/cmd/server/VERSION',
  'backend/internal/handler/admin/admin_basic_handlers_test.go',
  'backend/internal/handler/admin/admin_service_stub_test.go',
  'backend/internal/handler/admin/group_handler.go',
  'backend/internal/repository/api_key_repo_profit_projection_integration_test.go',
  'backend/internal/repository/auth_cache_invalidation_profit_integration_test.go',
  'backend/internal/repository/migrations_schema_integration_test.go',
  'backend/internal/repository/group_usage_rollup_trigger_integration_test.go',
  'backend/internal/service/admin_group.go',
  'backend/internal/service/admin_group_duplicate.go',
  'backend/internal/service/admin_group_duplicate_test.go',
  'backend/internal/service/admin_group_model_pricing_test.go',
  'backend/internal/service/api_key_auth_cache_group_pricing_test.go',
  'backend/internal/service/api_key_auth_cache_impl.go',
  'backend/internal/service/api_key_auth_cache_profit_test.go',
  'backend/internal/service/api_key_service_cache_test.go',
  'backend/internal/service/batch_image_public.go',
  'backend/internal/service/batch_image_public_test.go',
  'backend/internal/service/billing_service.go',
  'backend/internal/service/billing_service_unified_test.go',
  'backend/internal/service/channel_plaza.go',
  'backend/internal/service/channel_plaza_test.go',
  'backend/internal/service/model_pricing_resolver.go',
  'backend/internal/service/openai_gateway_record_usage_test.go',
  'backend/internal/service/channel_pricing_multipliers_test.go',
  'backend/migrations/222_group_pricing_auth_cache_invalidation.sql',
  'backend/migrations/group_pricing_auth_cache_migration_test.go',
].sort()

test('assigns additive surfaces to the five named overlays', () => {
  assert.deepEqual(
    evaluateChangedPaths(
      [
        '.github/workflows/zero-one-publish.yml',
        'README.md',
        'deploy/zero-one/compose.yml',
        'frontend/src/style.css',
        'landing/src/App.tsx',
        'artifacts/design-qa/latest-desktop-top-1440x900.png',
        'assets/posters/zero-one-api-pricing-poster-v1.png',
      ],
      baseline,
    ),
    [],
  )
})

test('keeps temporary correctness files in expiring legacy hotfix blocks', () => {
  assert.deepEqual(evaluateChangedPaths(approvedLegacyHotfixPaths, baseline), [])
  assert.deepEqual(
    baseline.legacy_hotfixes.flatMap((hotfix) => hotfix.paths).sort(),
    approvedLegacyHotfixPaths,
  )
  for (const hotfix of baseline.legacy_hotfixes) {
    assert.match(hotfix.exit_condition, /stable upstream release/)
  }
})

test('rejects adjacent backend and unrelated upstream changes', () => {
  assert.deepEqual(
    evaluateChangedPaths(
      [
        'backend/internal/service/channel.go',
        'backend/internal/server/routes/payment.go',
        'backend/migrations/223_unreviewed.sql',
        'frontend/src/views/user/AvailableChannelsView.vue',
      ],
      baseline,
    ),
    [
      'backend/internal/server/routes/payment.go is outside the approved overlay registry',
      'backend/internal/service/channel.go is outside the approved overlay registry',
      'backend/migrations/223_unreviewed.sql is outside the approved overlay registry',
      'frontend/src/views/user/AvailableChannelsView.vue is outside the approved overlay registry',
    ],
  )
})

test('allows named immutable exceptions while adjacent seam files still fail', () => {
  assert.deepEqual(
    evaluateChangedPaths(
      [
        'frontend/src/api/admin/settings.ts',
        'frontend/src/api/admin/redeem.ts',
        'frontend/src/api/__tests__/admin.redeem.spec.ts',
        'frontend/src/types/index.ts',
        'frontend/src/api/admin/users.ts',
        'frontend/src/types/admin.ts',
        'frontend/vite.config.ts',
      ],
      baseline,
    ),
    [
      'frontend/src/api/admin/users.ts modifies immutable upstream path frontend/src/api/',
      'frontend/src/types/admin.ts modifies immutable upstream path frontend/src/types/',
    ],
  )
  assert.deepEqual(
    baseline.immutable_exceptions,
    [
      {
        name: 'public-capabilities-admin-settings-api',
        owner: 'Public Capabilities',
        path: 'frontend/src/api/admin/settings.ts',
        immutable_path: 'frontend/src/api/',
      },
      {
        name: 'public-capabilities-shared-contract-types',
        owner: 'Public Capabilities',
        path: 'frontend/src/types/index.ts',
        immutable_path: 'frontend/src/types/',
      },
      {
        name: 'public-capabilities-redeem-api',
        owner: 'Public Capabilities',
        path: 'frontend/src/api/admin/redeem.ts',
        immutable_path: 'frontend/src/api/',
      },
      {
        name: 'public-capabilities-redeem-api-test',
        owner: 'Public Capabilities',
        path: 'frontend/src/api/__tests__/admin.redeem.spec.ts',
        immutable_path: 'frontend/src/api/',
      },
      {
        name: 'console-skin-vite-config',
        owner: 'Console Skin',
        path: 'frontend/vite.config.ts',
        immutable_path: 'frontend/vite.config.ts',
      },
    ],
  )
})

test('allows only exact-content upstream security backports', () => {
  const approvedPaths = baseline.approved_backports.flatMap((backport) => Object.keys(backport.files))

  assert.deepEqual(evaluateChangedPaths(approvedPaths, baseline), [])
  assert.deepEqual(evaluateApprovedBackportContents(baseline, readRepositoryPath), [])
  assert.ok(baseline.immutable_paths.includes('frontend/pnpm-lock.yaml'))
  assert.ok(!baseline.overlays.some(({ paths }) => paths.includes('frontend/pnpm-lock.yaml')))
})

test('requires the stable tag to peel to the pinned baseline commit', () => {
  assert.deepEqual(evaluateReleaseTag(baseline, baseline.commit), [])
  assert.deepEqual(evaluateReleaseTag(baseline, 'f'.repeat(40)), [
    `upstream release tag ${baseline.release} peels to ${'f'.repeat(40)}, expected ${baseline.commit}`,
  ])
})

test('rejects duplicate owners, overlapping paths, and unbound immutable exceptions', () => {
  const duplicateOwner = structuredClone(baseline)
  duplicateOwner.overlays[1].owner = duplicateOwner.overlays[0].owner
  assert.throws(() => validateBaseline(duplicateOwner), /duplicate overlay owner/)

  const overlappingPath = structuredClone(baseline)
  overlappingPath.overlays[2].paths.push('landing/src/App.tsx')
  assert.throws(() => validateBaseline(overlappingPath), /overlay path overlap/)

  const globPath = structuredClone(baseline)
  globPath.overlays[0].paths[0] = 'frontend/src/**/*.vue'
  assert.throws(() => validateBaseline(globPath), /path is invalid/)

  const wrongOwner = structuredClone(baseline)
  wrongOwner.immutable_exceptions[0].owner = 'Console Skin'
  assert.throws(() => validateBaseline(wrongOwner), /must bind to exactly one path owned by Console Skin/)

  const directoryException = structuredClone(baseline)
  directoryException.immutable_exceptions[0].path = 'frontend/src/api/admin/'
  assert.throws(() => validateBaseline(directoryException), /path is invalid/)
})

test('rejects changed, missing, and non-regular approved backport files', () => {
  const approvedBaseline = baselineWithApprovedBackport()
  const changed = evaluateApprovedBackportContents(approvedBaseline, (path) => {
    const file = readRepositoryPath(path)
    return path === 'backend/Dockerfile'
      ? { ...file, content: Buffer.concat([file.content, Buffer.from('\n')]) }
      : file
  })
  assert.equal(changed.length, 1)
  assert.match(changed[0], /backend\/Dockerfile content mismatch/)

  const missing = evaluateApprovedBackportContents(approvedBaseline, (path) => {
    if (path === 'deploy/Dockerfile') throw new Error('missing')
    return readRepositoryPath(path)
  })
  assert.deepEqual(missing, ['approved backport deploy/Dockerfile is missing'])

  const nonRegular = evaluateApprovedBackportContents(approvedBaseline, (path) => {
    const file = readRepositoryPath(path)
    return path === 'Dockerfile' ? { ...file, isRegularFile: false } : file
  })
  assert.deepEqual(nonRegular, ['approved backport Dockerfile is not a regular file'])

  const executable = evaluateApprovedBackportContents(approvedBaseline, (path) => {
    const file = readRepositoryPath(path)
    return path === 'Dockerfile' ? { ...file, mode: '100755' } : file
  })
  assert.deepEqual(executable, [
    'approved backport Dockerfile mode mismatch: expected 100644, got 100755',
  ])
})

test('rejects stale or malformed approved backport metadata', () => {
  const approvedBaseline = baselineWithApprovedBackport()
  const clone = () => structuredClone(approvedBaseline)

  const stale = clone()
  stale.release = 'v0.1.176'
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
  badHash.approved_backports[0].files['backend/Dockerfile'].sha256 = '0'
  assert.throws(() => validateBaseline(badHash), /sha256 is invalid: backend\/Dockerfile/)

  const badMode = clone()
  badMode.approved_backports[0].files['backend/Dockerfile'].mode = '100600'
  assert.throws(() => validateBaseline(badMode), /mode is invalid: backend\/Dockerfile/)

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
  assert.throws(() => validateBaseline(alreadyAllowed), /already owned by another registry block/)
})
