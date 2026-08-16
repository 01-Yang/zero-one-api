package service

import (
	"fmt"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/Wei-Shaw/sub2api/internal/config"
)

const (
	DefaultLandingNoticeText  = ""
	DefaultLandingNoticeURL   = ""
	LandingNoticeTextMaxRunes = 160
)

func landingNoticeSettingOrDefault(settings map[string]string, key, defaultValue string) string {
	if value, ok := settings[key]; ok {
		return value
	}
	return defaultValue
}

func normalizeLandingNoticeText(text string) (string, error) {
	text = strings.TrimSpace(text)
	if utf8.RuneCountInString(text) > LandingNoticeTextMaxRunes {
		return "", fmt.Errorf("landing notice text must be at most %d characters", LandingNoticeTextMaxRunes)
	}
	for _, r := range text {
		if unicode.IsControl(r) {
			return "", fmt.Errorf("landing notice text must be single-line plain text")
		}
	}
	return text, nil
}

func normalizeLandingNoticeURL(targetURL string) (string, error) {
	targetURL = strings.TrimSpace(targetURL)
	if targetURL == "" {
		return "", nil
	}
	if strings.ContainsRune(targetURL, '\\') {
		return "", fmt.Errorf("landing notice URL must not contain backslashes")
	}
	if err := config.ValidateFrontendRedirectURL(targetURL); err != nil {
		return "", fmt.Errorf("landing notice URL must be a safe relative path or an http(s) URL: %w", err)
	}
	return targetURL, nil
}

// NormalizeLandingNoticeSettings validates values submitted through the admin
// API. Callers apply defaults only when a key is absent, so an administrator
// can intentionally clear the optional text or link.
func NormalizeLandingNoticeSettings(enabled bool, text, targetURL string) (bool, string, string, error) {
	text, err := normalizeLandingNoticeText(text)
	if err != nil {
		return false, "", "", err
	}
	targetURL, err = normalizeLandingNoticeURL(targetURL)
	if err != nil {
		return false, "", "", err
	}
	return enabled, text, targetURL, nil
}
