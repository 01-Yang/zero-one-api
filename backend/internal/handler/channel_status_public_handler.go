package handler

import (
	"context"
	"fmt"

	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	"github.com/Wei-Shaw/sub2api/internal/service"

	"github.com/gin-gonic/gin"
)

// PublicSummary returns an anonymous-safe aggregate for the landing page.
// The service, rather than the browser, reads the private monitor records.
func (h *ChannelMonitorUserHandler) PublicSummary(c *gin.Context) {
	summary, err := h.GetPublicSummary(c.Request.Context())
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, summary)
}

func (h *ChannelMonitorUserHandler) GetPublicSummary(ctx context.Context) (*service.PublicChannelStatusSummary, error) {
	if h == nil || h.monitorService == nil {
		return nil, fmt.Errorf("channel status is unavailable")
	}
	return h.monitorService.GetPublicChannelStatusSummary(ctx)
}

// PublicSummary returns an anonymous-safe V2 traffic-health aggregate. The
// response contract intentionally remains identical to the V1 landing view.
func (h *ChannelMonitorV2Handler) PublicSummary(c *gin.Context) {
	summary, err := h.GetPublicSummary(c.Request.Context())
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, summary)
}

func (h *ChannelMonitorV2Handler) GetPublicSummary(ctx context.Context) (*service.PublicChannelStatusSummary, error) {
	if h == nil || h.service == nil {
		return nil, fmt.Errorf("channel status is unavailable")
	}
	return h.service.GetPublicChannelStatusSummary(ctx)
}
