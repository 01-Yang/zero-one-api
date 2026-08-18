-- Welfare and mystery-box codes share a batch. A user may claim at most one
-- code from that batch, enforced by PostgreSQL rather than application checks.
ALTER TABLE redeem_codes
    ADD COLUMN IF NOT EXISTS code_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS batch_id VARCHAR(32),
    ADD COLUMN IF NOT EXISTS min_value DECIMAL(20,8) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_value DECIMAL(20,8) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_redeem_codes_code_hash
    ON redeem_codes (code_hash)
    WHERE code_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_redeem_codes_batch_user
    ON redeem_codes (batch_id, used_by)
    WHERE batch_id IS NOT NULL AND used_by IS NOT NULL;

COMMENT ON COLUMN redeem_codes.code_hash IS '新生成高熵卡密的 SHA-256 摘要；明文只在创建响应中返回一次';
COMMENT ON COLUMN redeem_codes.batch_id IS '同批次兑换码共享标识；与 used_by 唯一索引共同实现每人每批次限领一次';
COMMENT ON COLUMN redeem_codes.min_value IS '盲盒额度下限（含）';
COMMENT ON COLUMN redeem_codes.max_value IS '盲盒额度上限（含）';
