package dto

import (
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"
)

func TestRedeemCodeAdminGenerationResponseReturnsPlaintextOnce(t *testing.T) {
	plaintext := "0123456789abcdef0123456789abcdef"
	hash := service.RedeemCodeHash(plaintext)
	rc := &service.RedeemCode{Code: plaintext, CodeHash: &hash}

	out := RedeemCodeFromServiceAdmin(rc)

	require.Equal(t, plaintext, out.Code)
	require.False(t, out.CodeRedacted)
}

func TestRedeemCodeRoutineAdminReadRedactsLegacyPlaintext(t *testing.T) {
	rc := &service.RedeemCode{Code: "LEGACY-PLAINTEXT-CODE"}

	out := RedeemCodeFromServiceAdminRedacted(rc)

	require.Equal(t, "LEGA-****-CODE", out.Code)
	require.True(t, out.CodeRedacted)
}

func TestRedeemCodeStoredHashIdentifierIsMarkedRedacted(t *testing.T) {
	plaintext := "0123456789abcdef0123456789abcdef"
	hash := service.RedeemCodeHash(plaintext)
	rc := &service.RedeemCode{
		Code:     service.RedactedRedeemCode(plaintext, hash),
		CodeHash: &hash,
	}

	out := RedeemCodeFromServiceAdmin(rc)

	require.True(t, out.CodeRedacted)
	require.NotEqual(t, plaintext, out.Code)
}
