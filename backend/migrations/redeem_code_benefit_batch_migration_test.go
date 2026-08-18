package migrations

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRedeemCodeBenefitBatchMigrationEnforcesOneClaimPerUser(t *testing.T) {
	content, err := FS.ReadFile("225_redeem_code_benefit_batches.sql")
	require.NoError(t, err)

	sql := strings.Join(strings.Fields(string(content)), " ")
	require.Contains(t, sql, "ADD COLUMN IF NOT EXISTS code_hash VARCHAR(64)")
	require.Contains(t, sql, "ADD COLUMN IF NOT EXISTS batch_id VARCHAR(32)")
	require.Contains(t, sql, "CREATE UNIQUE INDEX IF NOT EXISTS idx_redeem_codes_code_hash")
	require.Contains(t, sql, "CREATE UNIQUE INDEX IF NOT EXISTS idx_redeem_codes_batch_user")
	require.Contains(t, sql, "WHERE batch_id IS NOT NULL AND used_by IS NOT NULL")
}
