-- Website announcements must be deliberately opted into. Existing records
-- remain private by default so an anonymous endpoint cannot expose historic
-- user-targeted or internal announcements.
ALTER TABLE announcements
    ADD COLUMN IF NOT EXISTS public_visible BOOLEAN NOT NULL DEFAULT FALSE;

-- The public feed only asks for active, public rows in newest-first order.
CREATE INDEX IF NOT EXISTS idx_announcements_public_active_id
    ON announcements (id DESC)
    WHERE public_visible = TRUE AND status = 'active';

COMMENT ON COLUMN announcements.public_visible IS '是否对未登录的官网访客公开展示';
