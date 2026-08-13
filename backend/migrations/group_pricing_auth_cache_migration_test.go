package migrations

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMigration221PreservesExistingLongContextBillingByDefault(t *testing.T) {
	content, err := FS.ReadFile("221_group_model_pricing.sql")
	require.NoError(t, err)

	sql := string(content)
	require.Contains(t, sql, "long_context_pricing_enabled BOOLEAN NOT NULL DEFAULT TRUE")
	require.Contains(t, sql, "model_pricing JSONB")
	require.Contains(t, sql, "SET long_context_pricing_enabled = TRUE")
}

func TestMigration222InvalidatesAuthCacheForGroupPricingChanges(t *testing.T) {
	content, err := FS.ReadFile("222_group_pricing_auth_cache_invalidation.sql")
	require.NoError(t, err)

	sql := string(content)
	require.Contains(t, sql, "CREATE OR REPLACE FUNCTION enqueue_group_auth_cache_invalidation()")
	require.Contains(t, sql, "OLD.long_context_pricing_enabled IS NOT DISTINCT FROM NEW.long_context_pricing_enabled")
	require.Contains(t, sql, "OLD.model_pricing IS NOT DISTINCT FROM NEW.model_pricing")
	require.Contains(t, sql, "INSERT INTO auth_cache_invalidation_outbox")
}
