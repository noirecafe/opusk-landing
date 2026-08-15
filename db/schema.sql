-- ===========================================================================
-- THE OPUSK — bảng lưu yêu cầu tư vấn thuê văn phòng
--
-- Chạy MỘT LẦN sau khi đã gắn database Postgres vào project Vercel.
-- Cách chạy: Vercel Dashboard → Storage → chọn database → tab "Query"
--            → dán toàn bộ file này → Run.
--
-- Script an toàn khi chạy lại nhiều lần (IF NOT EXISTS ở mọi lệnh).
-- ===========================================================================

CREATE TABLE IF NOT EXISTS leads (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Dữ liệu người dùng nhập
  full_name     text        NOT NULL,
  email         text        NOT NULL,
  phone         text        NOT NULL,
  company       text,
  requirements  text,

  -- Trạng thái xử lý của đội cho thuê
  status        text        NOT NULL DEFAULT 'new',
  notes         text,

  -- Siêu dữ liệu kỹ thuật
  ip_hash       text,          -- SHA-256 của IP + salt, KHÔNG lưu IP gốc
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT leads_status_valid
    CHECK (status IN ('new', 'contacted', 'qualified', 'won', 'lost'))
);

-- Danh sách mặc định: mới nhất lên đầu
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC);

-- Tra cứu theo email khi khách liên hệ lại
CREATE INDEX IF NOT EXISTS leads_email_idx ON leads (email);

-- Phục vụ truy vấn chống spam theo IP trong /api/lead.js
CREATE INDEX IF NOT EXISTS leads_ip_recent_idx ON leads (ip_hash, created_at DESC);

-- Lọc theo trạng thái khi đội cho thuê làm việc
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status);


-- ===========================================================================
-- CÁC CÂU LỆNH HAY DÙNG (chạy trong tab Query khi cần)
-- ===========================================================================

-- 20 yêu cầu mới nhất
--   SELECT id, created_at, full_name, phone, email, company, status
--   FROM leads ORDER BY created_at DESC LIMIT 20;

-- Yêu cầu chưa xử lý
--   SELECT * FROM leads WHERE status = 'new' ORDER BY created_at;

-- Đánh dấu đã liên hệ
--   UPDATE leads SET status = 'contacted', notes = 'Đã gọi ngày 20/8'
--   WHERE id = 1;

-- Xuất CSV để gửi cho đội sales
--   SELECT created_at, full_name, phone, email, company, requirements
--   FROM leads ORDER BY created_at DESC;

-- Đếm theo ngày
--   SELECT date_trunc('day', created_at) AS ngay, count(*)
--   FROM leads GROUP BY 1 ORDER BY 1 DESC;
