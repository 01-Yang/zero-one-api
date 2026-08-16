package service

import (
	"context"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	"github.com/stretchr/testify/require"
)

type announcementRepoStub struct {
	item        *Announcement
	publicItems []Announcement
	publicErr   error
}

func (s *announcementRepoStub) Create(_ context.Context, a *Announcement) error {
	s.item = a
	return nil
}

func (s *announcementRepoStub) GetByID(_ context.Context, _ int64) (*Announcement, error) {
	if s.item == nil {
		return nil, ErrAnnouncementNotFound
	}
	return s.item, nil
}

func (s *announcementRepoStub) Update(_ context.Context, a *Announcement) error {
	s.item = a
	return nil
}

func (*announcementRepoStub) Delete(context.Context, int64) error {
	return nil
}

func (*announcementRepoStub) List(context.Context, pagination.PaginationParams, AnnouncementListFilters) ([]Announcement, *pagination.PaginationResult, error) {
	return nil, nil, nil
}

func (*announcementRepoStub) ListActive(context.Context, time.Time) ([]Announcement, error) {
	return nil, nil
}

func (s *announcementRepoStub) ListPublic(context.Context, time.Time) ([]Announcement, error) {
	return s.publicItems, s.publicErr
}

func TestAnnouncementServiceCreateRejectsEqualStartEndTimes(t *testing.T) {
	repo := &announcementRepoStub{}
	svc := NewAnnouncementService(repo, nil, nil, nil)
	now := time.Unix(1776790020, 0)

	_, err := svc.Create(context.Background(), &CreateAnnouncementInput{
		Title:      "公告",
		Content:    "内容",
		Status:     AnnouncementStatusActive,
		NotifyMode: AnnouncementNotifyModePopup,
		StartsAt:   &now,
		EndsAt:     &now,
	})
	require.ErrorIs(t, err, ErrAnnouncementInvalidSchedule)
}

func TestAnnouncementServiceUpdateRejectsEqualStartEndTimes(t *testing.T) {
	repo := &announcementRepoStub{
		item: &Announcement{
			ID:         1,
			Title:      "公告",
			Content:    "内容",
			Status:     AnnouncementStatusActive,
			NotifyMode: AnnouncementNotifyModePopup,
		},
	}
	svc := NewAnnouncementService(repo, nil, nil, nil)
	now := time.Unix(1776790020, 0)
	startsAt := &now
	endsAt := &now

	_, err := svc.Update(context.Background(), 1, &UpdateAnnouncementInput{
		StartsAt: &startsAt,
		EndsAt:   &endsAt,
	})
	require.ErrorIs(t, err, ErrAnnouncementInvalidSchedule)
}

func TestAnnouncementServiceListPublicFailsClosedForNonPublicOrInactiveItems(t *testing.T) {
	now := time.Now()
	started := now.Add(-time.Minute)
	expired := now.Add(-time.Second)
	future := now.Add(time.Minute)
	repo := &announcementRepoStub{
		publicItems: []Announcement{
			{ID: 1, Title: "公开有效", Content: "内容", Status: AnnouncementStatusActive, PublicVisible: true, StartsAt: &started},
			{ID: 2, Title: "未公开", Content: "内容", Status: AnnouncementStatusActive, PublicVisible: false},
			{ID: 3, Title: "已过期", Content: "内容", Status: AnnouncementStatusActive, PublicVisible: true, EndsAt: &expired},
			{ID: 4, Title: "尚未开始", Content: "内容", Status: AnnouncementStatusActive, PublicVisible: true, StartsAt: &future},
			{ID: 5, Title: "草稿", Content: "内容", Status: AnnouncementStatusDraft, PublicVisible: true},
		},
	}

	items, err := NewAnnouncementService(repo, nil, nil, nil).ListPublic(context.Background())
	require.NoError(t, err)
	require.Len(t, items, 1)
	require.Equal(t, int64(1), items[0].ID)
}

func TestAnnouncementServiceUpdateCanDisablePublicVisibility(t *testing.T) {
	repo := &announcementRepoStub{
		item: &Announcement{
			ID:            1,
			Title:         "官网公告",
			Content:       "内容",
			Status:        AnnouncementStatusActive,
			NotifyMode:    AnnouncementNotifyModeSilent,
			PublicVisible: true,
		},
	}
	publicVisible := false

	updated, err := NewAnnouncementService(repo, nil, nil, nil).Update(context.Background(), 1, &UpdateAnnouncementInput{
		PublicVisible: &publicVisible,
	})

	require.NoError(t, err)
	require.False(t, updated.PublicVisible)
}
