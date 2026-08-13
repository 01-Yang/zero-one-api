package service

import (
	"testing"

	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
	"github.com/stretchr/testify/require"
)

func TestNormalizeGroupModelPricingUsesGroupPlatformForConflictDetection(t *testing.T) {
	input := []ChannelModelPricing{
		{Platform: PlatformOpenAI, Models: []string{"grok-4.*"}, BillingMode: BillingModeToken},
		{Platform: PlatformAnthropic, Models: []string{"grok-4.6"}, BillingMode: BillingModeToken},
	}

	_, err := normalizeGroupModelPricing(PlatformGrok, input)

	require.Error(t, err)
	require.Equal(t, "MODEL_PATTERN_CONFLICT", infraerrors.Reason(err),
		"runtime matching ignores the entry platform, so validation must not let it partition conflicts")
}

func TestNormalizeGroupModelPricingCanonicalizesPlatformAndRejectsInvalidInput(t *testing.T) {
	t.Run("canonicalizes platform", func(t *testing.T) {
		out, err := normalizeGroupModelPricing(PlatformGemini, []ChannelModelPricing{{
			Platform:    PlatformOpenAI,
			Models:      []string{" gemini-3.1-flash-image "},
			BillingMode: BillingModeImage,
			PerRequestPrice: func() *float64 {
				value := 0.1
				return &value
			}(),
		}})

		require.NoError(t, err)
		require.Equal(t, PlatformGemini, out[0].Platform)
		require.Equal(t, []string{"gemini-3.1-flash-image"}, out[0].Models)
	})

	t.Run("rejects invalid billing mode", func(t *testing.T) {
		_, err := normalizeGroupModelPricing(PlatformOpenAI, []ChannelModelPricing{{
			Models:      []string{"gpt-5.4"},
			BillingMode: BillingMode("surprise"),
		}})

		require.Error(t, err)
		require.Equal(t, "INVALID_BILLING_MODE", infraerrors.Reason(err))
	})

	t.Run("rejects blank model", func(t *testing.T) {
		_, err := normalizeGroupModelPricing(PlatformOpenAI, []ChannelModelPricing{{
			Models: []string{"   "},
		}})

		require.Error(t, err)
		require.Equal(t, "GROUP_MODEL_PRICING_MODELS_REQUIRED", infraerrors.Reason(err))
	})
}
