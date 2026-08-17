/* ==========================================================================
   POST /api/lead — nhận yêu cầu tư vấn thuê văn phòng

   Chạy dưới dạng Vercel Serverless Function (Node.js runtime). Không cần
   khai báo gì trong vercel.json: mọi file trong thư mục /api đều tự động
   trở thành một endpoint.

   Database: Postgres (Neon) cài qua Vercel Marketplace. Tích hợp tự tiêm
   biến môi trường DATABASE_URL vào project — file này chỉ việc đọc.

   Nếu CHƯA cấu hình database, endpoint trả 503 kèm thông điệp rõ ràng; giao
   diện sẽ hiện số hotline thay vì báo lỗi vô nghĩa. Trang web vẫn dùng được
   trước khi bạn kịp dựng database.

   Google Sheet: nếu đã cấu hình đủ 3 biến GOOGLE_SERVICE_ACCOUNT_EMAIL,
   GOOGLE_PRIVATE_KEY, GOOGLE_SHEET_ID thì mỗi lead lưu vào Postgres xong sẽ
   được ghi thêm một dòng vào Google Sheet ngay lập tức. Nếu thiếu biến hoặc
   ghi Sheet bị lỗi, request vẫn trả về thành công bình thường — Postgres là
   nguồn dữ liệu chính, Sheet chỉ là bản sao tiện xem/chia sẻ, không được
   phép làm hỏng luồng lưu lead.
   ========================================================================== */

import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';

/* --- Giới hạn độ dài, khớp với maxlength ở phía giao diện --- */
const LIMIT = { name: 120, email: 160, phone: 40, company: 160, message: 4000 };

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RE_PHONE = /^[+()\d][\d\s.\-()]{7,19}$/;

/* Số yêu cầu tối đa từ cùng một IP trong 10 phút */
const RATE_MAX     = 3;
const RATE_MINUTES = 10;

function clean(v, max) {
  if (typeof v !== 'string') return '';
  // Bỏ ký tự điều khiển, gộp khoảng trắng, cắt theo giới hạn
  return v
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return req.headers['x-real-ip'] || '';
}

/* Băm IP thay vì lưu thẳng: đủ để chống spam, không lưu dữ liệu định danh */
function hashIp(ip) {
  if (!ip) return null;
  const salt = process.env.LEAD_IP_SALT || 'opusk-default-salt';
  return crypto.createHash('sha256').update(salt + '|' + ip).digest('hex').slice(0, 32);
}

/* ---- Ghi thêm 1 dòng vào Google Sheet — chạy sau khi đã lưu Postgres ----
   Best-effort: lỗi ở đây chỉ log ra, không throw, không ảnh hưởng response. */
async function appendToSheet(row) {
  const email      = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId     = process.env.GOOGLE_SHEET_ID;

  if (!email || !privateKey || !sheetId) return; // chưa cấu hình — bỏ qua êm

  try {
    const auth = new JWT({
      email,
      key: privateKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(sheetId, auth);
    await doc.loadInfo();

    const sheet = doc.sheetsByIndex[0];
    await sheet.addRow({
      id:           String(row.id),
      created_at:   row.created_at,
      full_name:    row.full_name,
      email:        row.email,
      phone:        row.phone,
      company:      row.company || '',
      requirements: row.requirements || '',
      status:       'new',
    });
  } catch (err) {
    console.error('[lead] Ghi Google Sheet thất bại (bỏ qua, không chặn lead):', err);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!dbUrl) {
    console.error('[lead] Thiếu DATABASE_URL — chưa gắn database vào project.');
    return res.status(503).json({ ok: false, error: 'db_not_configured' });
  }

  /* ---- Đọc body (Vercel tự parse JSON; vẫn phòng trường hợp là chuỗi) ---- */
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body || typeof body !== 'object') body = {};

  /* ---- Bẫy spam: ô ẩn có nội dung ⇒ bot. Trả 201 để bot tưởng đã xong. ---- */
  if (clean(body.website, 200)) {
    return res.status(201).json({ ok: true });
  }

  /* ---- Làm sạch + kiểm tra ---- */
  const name    = clean(body.name,    LIMIT.name);
  const email   = clean(body.email,   LIMIT.email).toLowerCase();
  const phone   = clean(body.phone,   LIMIT.phone);
  const company = clean(body.company, LIMIT.company);
  const message = clean(body.message, LIMIT.message);

  const fields = {};
  if (name.length < 2)      fields.name  = 'Vui lòng nhập họ và tên.';
  if (!RE_EMAIL.test(email)) fields.email = 'Email chưa hợp lệ.';
  if (!RE_PHONE.test(phone)) fields.phone = 'Số điện thoại chưa hợp lệ.';

  if (Object.keys(fields).length) {
    return res.status(422).json({ ok: false, error: 'validation_failed', fields });
  }

  const ipHash    = hashIp(clientIp(req));
  const userAgent = clean(req.headers['user-agent'], 300);

  try {
    const sql = neon(dbUrl);

    /* ---- Chống spam theo IP ---- */
    if (ipHash) {
      const [row] = await sql`
        SELECT count(*)::int AS n
        FROM leads
        WHERE ip_hash = ${ipHash}
          AND created_at > now() - make_interval(mins => ${RATE_MINUTES})
      `;
      if (row && row.n >= RATE_MAX) {
        return res.status(429).json({ ok: false, error: 'rate_limited' });
      }
    }

    const [saved] = await sql`
      INSERT INTO leads (full_name, email, phone, company, requirements, ip_hash, user_agent)
      VALUES (${name}, ${email}, ${phone}, ${company || null}, ${message || null},
              ${ipHash}, ${userAgent || null})
      RETURNING id, created_at
    `;

    console.log('[lead] Đã lưu #' + saved.id);

    // Ghi thêm sang Google Sheet — không await chặn response, không làm fail lead
    // nếu Sheet lỗi. Vercel giữ function sống tới khi promise này xong nhờ waitUntil
    // nếu có, còn không thì vẫn kịp chạy xong trong hầu hết trường hợp vì rất nhanh.
    if (typeof res.waitUntil === 'function') {
      res.waitUntil(appendToSheet({ ...saved, full_name: name, email, phone, company, requirements: message }));
    } else {
      await appendToSheet({ ...saved, full_name: name, email, phone, company, requirements: message });
    }

    return res.status(201).json({ ok: true, id: saved.id });

  } catch (err) {
    /* Bảng chưa được tạo — lỗi hay gặp nhất ở lần deploy đầu */
    if (err && (err.code === '42P01' || /relation .*leads.* does not exist/i.test(err.message || ''))) {
      console.error('[lead] Bảng "leads" chưa tồn tại. Hãy chạy db/schema.sql.');
      return res.status(503).json({ ok: false, error: 'table_missing' });
    }
    console.error('[lead] Lỗi ghi database:', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}
