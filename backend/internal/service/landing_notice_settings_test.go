//go:build unit

package service

import (
	"context"
	"strings"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/stretchr/testify/require"
)

func TestNormalizeLandingNoticeSettings(t *testing.T) {
	t.Run("preserves intentionally empty optional values", func(t *testing.T) {
		enabled, text, targetURL, err := NormalizeLandingNoticeSettings(true, "  ", "  ")
		require.NoError(t, err)
		require.True(t, enabled)
		require.Empty(t, text)
		require.Empty(t, targetURL)
	})

	t.Run("accepts unicode text at the character limit", func(t *testing.T) {
		text := strings.Repeat("界", LandingNoticeTextMaxRunes)
		_, normalizedText, targetURL, err := NormalizeLandingNoticeSettings(true, text, " /keys?from=notice ")
		require.NoError(t, err)
		require.Equal(t, text, normalizedText)
		require.Equal(t, "/keys?from=notice", targetURL)
	})

	t.Run("accepts absolute http and https URLs", func(t *testing.T) {
		for _, targetURL := range []string{"http://example.com/keys", "https://example.com/keys"} {
			_, _, normalizedURL, err := NormalizeLandingNoticeSettings(true, "Notice", targetURL)
			require.NoError(t, err, "url=%q", targetURL)
			require.Equal(t, targetURL, normalizedURL)
		}
	})

	for name, input := range map[string]struct {
		text      string
		targetURL string
	}{
		"text over 160 characters": {text: strings.Repeat("界", LandingNoticeTextMaxRunes+1), targetURL: "/keys"},
		"multiline text":           {text: "line one\nline two", targetURL: "/keys"},
		"protocol relative URL":    {text: "Notice", targetURL: "//evil.example/keys"},
		"javascript URL":           {text: "Notice", targetURL: "javascript:alert(1)"},
		"backslash URL":            {text: "Notice", targetURL: `/\evil.example/keys`},
	} {
		t.Run("rejects "+name, func(t *testing.T) {
			_, _, _, err := NormalizeLandingNoticeSettings(true, input.text, input.targetURL)
			require.Error(t, err)
		})
	}
}

func TestSettingService_LandingNoticeDefaultsAcrossSettingsViews(t *testing.T) {
	publicService := NewSettingService(&settingPublicRepoStub{values: map[string]string{}}, &config.Config{})
	publicSettings, err := publicService.GetPublicSettings(context.Background())
	require.NoError(t, err)
	require.False(t, publicSettings.LandingNoticeEnabled)
	require.Empty(t, publicSettings.LandingNoticeText)
	require.Empty(t, publicSettings.LandingNoticeURL)

	injected, err := publicService.GetPublicSettingsForInjection(context.Background())
	require.NoError(t, err)
	injectionPayload, ok := injected.(*PublicSettingsInjectionPayload)
	require.True(t, ok)
	require.False(t, injectionPayload.LandingNoticeEnabled)
	require.Empty(t, injectionPayload.LandingNoticeText)
	require.Empty(t, injectionPayload.LandingNoticeURL)

	adminSettings, err := NewSettingService(&settingGetAllRepoStub{values: map[string]string{}}, &config.Config{}).
		GetAllSettings(context.Background())
	require.NoError(t, err)
	require.False(t, adminSettings.LandingNoticeEnabled)
	require.Empty(t, adminSettings.LandingNoticeText)
	require.Empty(t, adminSettings.LandingNoticeURL)
}

func TestSettingService_LandingNoticeConfiguredValuesAndSafeReadFallback(t *testing.T) {
	configured := NewSettingService(&settingPublicRepoStub{values: map[string]string{
		SettingKeyLandingNoticeEnabled: "false",
		SettingKeyLandingNoticeText:    "  Scheduled maintenance  ",
		SettingKeyLandingNoticeURL:     "  /status  ",
	}}, &config.Config{})
	settings, err := configured.GetPublicSettings(context.Background())
	require.NoError(t, err)
	require.False(t, settings.LandingNoticeEnabled)
	require.Equal(t, "Scheduled maintenance", settings.LandingNoticeText)
	require.Equal(t, "/status", settings.LandingNoticeURL)

	invalidPersistedURL := NewSettingService(&settingPublicRepoStub{values: map[string]string{
		SettingKeyLandingNoticeEnabled: "true",
		SettingKeyLandingNoticeText:    "Unsafe legacy value",
		SettingKeyLandingNoticeURL:     "javascript:alert(1)",
	}}, &config.Config{})
	settings, err = invalidPersistedURL.GetPublicSettings(context.Background())
	require.NoError(t, err)
	require.True(t, settings.LandingNoticeEnabled)
	require.Equal(t, "Unsafe legacy value", settings.LandingNoticeText)
	require.Empty(t, settings.LandingNoticeURL)

	adminSettings, err := NewSettingService(&settingGetAllRepoStub{values: map[string]string{
		SettingKeyLandingNoticeEnabled: "true",
		SettingKeyLandingNoticeText:    "Unsafe legacy value",
		SettingKeyLandingNoticeURL:     "javascript:alert(1)",
	}}, &config.Config{}).GetAllSettings(context.Background())
	require.NoError(t, err)
	require.True(t, adminSettings.LandingNoticeEnabled)
	require.Equal(t, "Unsafe legacy value", adminSettings.LandingNoticeText)
	require.Empty(t, adminSettings.LandingNoticeURL)

	intentionallyEmpty := NewSettingService(&settingPublicRepoStub{values: map[string]string{
		SettingKeyLandingNoticeEnabled: "true",
		SettingKeyLandingNoticeText:    "",
		SettingKeyLandingNoticeURL:     "",
	}}, &config.Config{})
	settings, err = intentionallyEmpty.GetPublicSettings(context.Background())
	require.NoError(t, err)
	require.True(t, settings.LandingNoticeEnabled)
	require.Empty(t, settings.LandingNoticeText)
	require.Empty(t, settings.LandingNoticeURL)
}

func TestSettingService_InitializeDefaultSettingsIncludesLandingNotice(t *testing.T) {
	repo := &forwardedIPMigrationRepoStub{values: map[string]string{}}
	svc := NewSettingService(repo, &config.Config{})

	require.NoError(t, svc.InitializeDefaultSettings(context.Background()))
	require.Equal(t, "false", repo.values[SettingKeyLandingNoticeEnabled])
	require.Empty(t, repo.values[SettingKeyLandingNoticeText])
	require.Empty(t, repo.values[SettingKeyLandingNoticeURL])
}

func TestSettingService_UpdateSettingsValidatesAndPersistsLandingNotice(t *testing.T) {
	repo := &settingUpdateRepoStub{}
	svc := NewSettingService(repo, &config.Config{})

	err := svc.UpdateSettings(context.Background(), &SystemSettings{
		LandingNoticeEnabled: true,
		LandingNoticeText:    "  New notice  ",
		LandingNoticeURL:     "  /keys  ",
	})
	require.NoError(t, err)
	require.Equal(t, "true", repo.updates[SettingKeyLandingNoticeEnabled])
	require.Equal(t, "New notice", repo.updates[SettingKeyLandingNoticeText])
	require.Equal(t, "/keys", repo.updates[SettingKeyLandingNoticeURL])

	repo.updates = nil
	err = svc.UpdateSettings(context.Background(), &SystemSettings{
		LandingNoticeEnabled: true,
		LandingNoticeText:    "",
		LandingNoticeURL:     "",
	})
	require.NoError(t, err)
	require.Empty(t, repo.updates[SettingKeyLandingNoticeText])
	require.Empty(t, repo.updates[SettingKeyLandingNoticeURL])

	repo.updates = nil
	err = svc.UpdateSettings(context.Background(), &SystemSettings{
		LandingNoticeEnabled: true,
		LandingNoticeText:    strings.Repeat("a", LandingNoticeTextMaxRunes+1),
		LandingNoticeURL:     "/keys",
	})
	require.Error(t, err)
	require.Nil(t, repo.updates)
}
