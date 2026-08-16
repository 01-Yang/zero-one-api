package routes

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/handler"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type publicAnnouncementRouteRepo struct {
	service.AnnouncementRepository
	items []service.Announcement
}

func (r *publicAnnouncementRouteRepo) ListPublic(context.Context, time.Time) ([]service.Announcement, error) {
	return r.items, nil
}

func TestPublicAnnouncementsAreAnonymousAndWhitelisted(t *testing.T) {
	gin.SetMode(gin.TestMode)
	createdAt := time.Date(2026, time.August, 16, 8, 0, 0, 0, time.UTC)
	repo := &publicAnnouncementRouteRepo{items: []service.Announcement{
		{
			ID:            7,
			Title:         "官网公告",
			Content:       "这是公开内容。",
			Status:        service.AnnouncementStatusActive,
			NotifyMode:    service.AnnouncementNotifyModePopup,
			PublicVisible: true,
			Targeting: service.AnnouncementTargeting{AnyOf: []service.AnnouncementConditionGroup{
				{AllOf: []service.AnnouncementCondition{{Type: service.AnnouncementConditionTypeBalance, Operator: service.AnnouncementOperatorGT, Value: 99}}},
			}},
			CreatedAt: createdAt,
			UpdatedAt: createdAt,
		},
	}}
	announcementHandler := handler.NewAnnouncementHandler(service.NewAnnouncementService(repo, nil, nil, nil))
	router := gin.New()
	RegisterPublicAnnouncementRoutes(
		router.Group("/api/v1"),
		&handler.Handlers{Announcement: announcementHandler},
		nil,
	)

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/announcements/public", nil))

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))

	var response struct {
		Code int              `json:"code"`
		Data []map[string]any `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.Equal(t, 0, response.Code)
	require.Len(t, response.Data, 1)
	require.Equal(t, float64(7), response.Data[0]["id"])
	require.Equal(t, "官网公告", response.Data[0]["title"])
	require.Equal(t, "这是公开内容。", response.Data[0]["content"])
	require.ElementsMatch(t, []string{"id", "title", "content"}, mapKeys(response.Data[0]))
}

func mapKeys(values map[string]any) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	return keys
}
