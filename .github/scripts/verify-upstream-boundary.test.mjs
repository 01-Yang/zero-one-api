import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { evaluateChangedPaths, validateBaseline } from './verify-upstream-boundary.mjs'

const baseline = validateBaseline(
  JSON.parse(readFileSync(new URL('../upstream-baseline.json', import.meta.url), 'utf8')),
)

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
