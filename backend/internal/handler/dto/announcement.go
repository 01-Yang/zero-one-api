package dto

import (
	"time"

	"github.com/Wei-Shaw/sub2api/internal/service"
)

type Announcement struct {
	ID            int64  `json:"id"`
	Title         string `json:"title"`
	Content       string `json:"content"`
	Status        string `json:"status"`
	NotifyMode    string `json:"notify_mode"`
	PublicVisible bool   `json:"public_visible"`

	Targeting service.AnnouncementTargeting `json:"targeting"`

	StartsAt *time.Time `json:"starts_at,omitempty"`
	EndsAt   *time.Time `json:"ends_at,omitempty"`

	CreatedBy *int64 `json:"created_by,omitempty"`
	UpdatedBy *int64 `json:"updated_by,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type UserAnnouncement struct {
	ID         int64  `json:"id"`
	Title      string `json:"title"`
	Content    string `json:"content"`
	NotifyMode string `json:"notify_mode"`

	StartsAt *time.Time `json:"starts_at,omitempty"`
	EndsAt   *time.Time `json:"ends_at,omitempty"`

	ReadAt *time.Time `json:"read_at,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func AnnouncementFromService(a *service.Announcement) *Announcement {
	if a == nil {
		return nil
	}
	return &Announcement{
		ID:            a.ID,
		Title:         a.Title,
		Content:       a.Content,
		Status:        a.Status,
		NotifyMode:    a.NotifyMode,
		PublicVisible: a.PublicVisible,
		Targeting:     a.Targeting,
		StartsAt:      a.StartsAt,
		EndsAt:        a.EndsAt,
		CreatedBy:     a.CreatedBy,
		UpdatedBy:     a.UpdatedBy,
		CreatedAt:     a.CreatedAt,
		UpdatedAt:     a.UpdatedAt,
	}
}

// PublicAnnouncement is the intentionally narrow contract exposed to
// anonymous website visitors. Do not add targeting, notification, actor, or
// read-status fields here: those are private administration/user data.
type PublicAnnouncement struct {
	ID      int64  `json:"id"`
	Title   string `json:"title"`
	Content string `json:"content"`
}

func PublicAnnouncementFromService(a *service.Announcement) *PublicAnnouncement {
	if a == nil {
		return nil
	}
	return &PublicAnnouncement{
		ID:      a.ID,
		Title:   a.Title,
		Content: a.Content,
	}
}

func UserAnnouncementFromService(a *service.UserAnnouncement) *UserAnnouncement {
	if a == nil {
		return nil
	}
	return &UserAnnouncement{
		ID:         a.Announcement.ID,
		Title:      a.Announcement.Title,
		Content:    a.Announcement.Content,
		NotifyMode: a.Announcement.NotifyMode,
		StartsAt:   a.Announcement.StartsAt,
		EndsAt:     a.Announcement.EndsAt,
		ReadAt:     a.ReadAt,
		CreatedAt:  a.Announcement.CreatedAt,
		UpdatedAt:  a.Announcement.UpdatedAt,
	}
}
