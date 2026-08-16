package routes

import (
	"github.com/Wei-Shaw/sub2api/internal/handler"
	"github.com/Wei-Shaw/sub2api/internal/server/middleware"

	"github.com/gin-gonic/gin"
)

// RegisterPublicAnnouncementRoutes registers the anonymous, read-only website
// feed. The service itself only returns announcements whose administrator has
// explicitly enabled public visibility.
func RegisterPublicAnnouncementRoutes(
	v1 *gin.RouterGroup,
	h *handler.Handlers,
	panelRateLimiter *middleware.PanelRateLimiter,
) {
	announcements := v1.Group("/announcements")
	announcements.Use(panelRateLimiter.PublicIP())
	announcements.GET("/public", h.Announcement.ListPublic)
}
