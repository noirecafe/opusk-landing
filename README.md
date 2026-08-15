# The OpusK — Landing Page

Trang landing tĩnh (HTML + CSS + JS thuần) **cộng thêm một API nhận yêu cầu
tư vấn** chạy dưới dạng Vercel Serverless Function, lưu vào Postgres.

Không có bước build. Vercel tự cài `@neondatabase/serverless` từ
`package.json` để chạy `/api/lead`.

---

## Mục lục

1. [Deploy lên Vercel](#1-deploy-lên-vercel)
2. [Cấu hình database — từng bước](#2-cấu-hình-database--từng-bước)
3. [Kiểm tra biểu mẫu chạy đúng](#3-kiểm-tra-biểu-mẫu-chạy-đúng)
4. [Xem và xuất dữ liệu khách đăng ký](#4-xem-và-xuất-dữ-liệu-khách-đăng-ký)
5. [Việc cần làm trước khi chạy thật](#5-việc-cần-làm-trước-khi-chạy-thật)
6. [Cấu trúc thư mục](#6-cấu-trúc-thư-mục)
7. [Ngân sách hiệu năng](#7-ngân-sách-hiệu-năng)

---

## 1. Deploy lên Vercel

### Cách 1 — Qua GitHub (nên dùng)

```bash
cd opusk-landing
git init
git add .
git commit -m "The OpusK landing page"
git branch -M main
git remote add origin https://github.com/<tài-khoản>/<repo>.git
git push -u origin main
```

Vào Vercel → **Add New… → Project** → chọn repo →

| Mục | Giá trị |
|---|---|
| Framework Preset | **Other** |
| Build Command | *(để trống)* |
| Output Directory | *(để trống)* |
| Install Command | *(để trống — Vercel tự chạy `npm install`)* |

Bấm **Deploy**. Từ đó mỗi `git push` là Vercel tự deploy lại.

### Cách 2 — Kéo thả

Vào <https://vercel.com/new>, kéo cả thư mục `opusk-landing` thả vào, chọn
**Framework Preset: Other**, để trống Build Command, bấm **Deploy**.

### Cách 3 — Vercel CLI

```bash
npm i -g vercel
cd opusk-landing
vercel          # bản xem trước
vercel --prod   # production
```

> **Lưu ý:** ngay sau bước này biểu mẫu **chưa lưu được** — cần làm tiếp
> mục 2. Trong lúc chờ, biểu mẫu sẽ hiện thông báo mời khách gọi hotline
> chứ không báo lỗi kỹ thuật.

---

## 2. Cấu hình database — từng bước

Vercel Postgres đã được chuyển sang **Neon** từ tháng 12/2024, cài qua
Marketplace. Làm đúng 4 bước sau.

### Bước 1 — Tạo database

1. Mở project vừa deploy trên Vercel
2. Tab **Storage** → **Create Database**
3. Chọn **Neon — Serverless Postgres** → **Continue**
4. Chọn gói **Free** (đủ dùng: 0.5 GB, thừa sức cho vài trăm nghìn lượt đăng ký)
5. Đặt tên, ví dụ `opusk-leads`
6. Chọn **Region** gần Việt Nam nhất — `Singapore (sin1)`
7. **Create**

### Bước 2 — Nối database vào project

Ngay sau khi tạo, Vercel hỏi nối vào project nào → chọn project landing page,
tick cả ba môi trường **Production · Preview · Development** → **Connect**.

Vercel tự tiêm các biến môi trường, quan trọng nhất là **`DATABASE_URL`**.
Kiểm tra ở **Settings → Environment Variables** — phải thấy `DATABASE_URL`.

> Nếu báo *"Failed to set environment variables"*: vào Settings →
> Environment Variables, xoá các biến trùng tên có sẵn (`DATABASE_URL`,
> `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`) rồi nối lại.

### Bước 3 — Tạo bảng `leads`

1. Tab **Storage** → bấm vào database `opusk-leads`
2. Chọn tab **Query** (hoặc **Open in Neon** → SQL Editor)
3. Mở file `db/schema.sql` trong repo, copy **toàn bộ**, dán vào ô truy vấn
4. Bấm **Run**

Chạy lại nhiều lần cũng không sao — script dùng `IF NOT EXISTS` ở mọi lệnh.

Kiểm tra bằng câu lệnh:

```sql
SELECT count(*) FROM leads;
```

Trả về `0` là bảng đã tạo xong.

### Bước 4 — Thêm salt cho việc băm IP *(nên làm)*

API băm địa chỉ IP để chống spam mà không lưu dữ liệu định danh. Đặt một
chuỗi bí mật riêng:

**Settings → Environment Variables → Add New**

| Key | Value | Environments |
|---|---|---|
| `LEAD_IP_SALT` | một chuỗi ngẫu nhiên dài, ví dụ `opusk-8f3a91c7d2e5b604` | Production, Preview, Development |

Sau khi thêm biến môi trường, phải **Redeploy** thì mới có hiệu lực:
Deployments → deployment mới nhất → dấu `⋯` → **Redeploy**.

---

## 3. Kiểm tra biểu mẫu chạy đúng

1. Mở `https://<domain>/lien-he`
2. Điền thử và bấm **Gửi yêu cầu**
3. Thấy màn hình xác nhận màu xanh ⇒ đã lưu thành công
4. Vào Storage → Query, chạy:

```sql
SELECT id, created_at, full_name, phone, email FROM leads ORDER BY id DESC LIMIT 5;
```

### Khi có lỗi

| Hiện tượng trên trang | Nguyên nhân | Cách xử lý |
|---|---|---|
| "Hệ thống tiếp nhận đang được cấu hình" | Thiếu `DATABASE_URL`, hoặc bảng `leads` chưa tồn tại | Làm lại Bước 2 và Bước 3 |
| "Bạn vừa gửi một yêu cầu…" | Chống spam: quá 3 lần trong 10 phút từ cùng một IP | Bình thường. Đổi trong `api/lead.js` (`RATE_MAX`) nếu muốn |
| "Không gửi được yêu cầu" | Lỗi máy chủ | Vercel → Deployments → Functions → xem log `/api/lead` |
| "Mất kết nối tới máy chủ" | Trình duyệt không gọi được API | Kiểm tra mạng; nếu mở bằng `file://` thì API không chạy — phải chạy qua Vercel hoặc `vercel dev` |

**Chạy thử ở máy** (có cả API): `vercel dev` — không dùng `npx serve`, vì
serve chỉ phục vụ file tĩnh, không chạy được `/api`.

---

## 4. Xem và xuất dữ liệu khách đăng ký

Vào **Storage → database → Query**:

```sql
-- 20 yêu cầu mới nhất
SELECT id, created_at, full_name, phone, email, company, status
FROM leads ORDER BY created_at DESC LIMIT 20;

-- Chưa xử lý
SELECT * FROM leads WHERE status = 'new' ORDER BY created_at;

-- Đánh dấu đã liên hệ
UPDATE leads SET status = 'contacted', notes = 'Đã gọi 20/8' WHERE id = 1;

-- Xuất cho đội sales (bấm Download CSV ở góc bảng kết quả)
SELECT created_at, full_name, phone, email, company, requirements
FROM leads ORDER BY created_at DESC;
```

Cột `status` nhận các giá trị: `new` · `contacted` · `qualified` · `won` · `lost`.

---

## 5. Việc cần làm trước khi chạy thật

**1. Đổi domain.** Thay `https://theopusk.com/` bằng domain thật trong
`index.html` và `lien-he.html` (thẻ `canonical`, `og:url`, `@id` trong JSON-LD).

**2. Thay link mạng xã hội** — đang là placeholder:

| Chỗ | Giá trị hiện tại |
|---|---|
| Facebook | `facebook.com/theopuskoffice` |
| Instagram | `instagram.com/theopuskoffice` |
| LinkedIn | `linkedin.com/company/theopusk` |
| Messenger (nút nổi) | `m.me/theopuskoffice` |

**3. Gắn domain riêng.** Vercel → Settings → Domains.

**4. Cân nhắc gửi email báo có khách mới.** Hiện dữ liệu chỉ nằm trong
database — không ai được báo. Muốn nhận email mỗi lần có đăng ký thì thêm
[Resend](https://resend.com) vào `api/lead.js` (khoảng 10 dòng, gọi ngay sau
lệnh `INSERT`).

---

## 6. Cấu trúc thư mục

```
opusk-landing/
├── index.html              Trang chủ + JSON-LD (SEO / GEO)
├── lien-he.html            Trang liên hệ + biểu mẫu đăng ký
├── api/
│   └── lead.js             POST /api/lead — validate, chống spam, ghi DB
├── db/
│   └── schema.sql          Tạo bảng leads (chạy tay một lần)
├── package.json            Khai báo @neondatabase/serverless
├── vercel.json             Header cache & bảo mật
├── .vercelignore           Loại ~17 MB file nguồn khỏi bản deploy
├── css/
│   └── style.css           Design token + toàn bộ style (mobile-first)
├── js/
│   ├── core.js             Lenis + hạ tầng ScrollTrigger + lưới an toàn
│   ├── map3d.js            Cảnh bản đồ 3D (vanilla, tự chạy vòng lặp)
│   ├── ui.js               Nav, menu, nút nổi, bản đồ footer
│   ├── animations.js       Choreography GSAP
│   └── form.js             Trang liên hệ: validate + gửi
├── assets/
│   ├── map/                14 lớp bản đồ 3D (.webp)
│   ├── _original/          Ảnh gốc chưa nén — KHÔNG deploy
│   └── _unused/            Ảnh không dùng — KHÔNG deploy
└── ANIMATION-MAP.md        Bản đồ chuyển động, dùng khi QA
```

---

## 7. Ngân sách hiệu năng

| Hạng mục | Dung lượng |
|---|---|
| Tải lần đầu (code + hero) | ~270 KB |
| Lớp bản đồ 3D (lazy) | ~901 KB |
| Ảnh còn lại (lazy) | ~911 KB |
| Video hero (webm, chỉ desktop) | ~1.8 MB |

Bản đồ 3D chạy vòng lặp 7.8 s **độc lập với thao tác cuộn**, tự dừng
`requestAnimationFrame` khi ra khỏi khung nhìn hoặc khi chuyển tab.

Trang không dùng ScrollTrigger `pin` — mọi khối "dính" đều là `position:
sticky` thuần CSS, nên không có pin-spacer và không sinh khoảng trắng.

### Phụ thuộc bên ngoài

Nạp qua CDN; nếu bị chặn thì trang vẫn hiển thị đầy đủ nội dung, chỉ mất
hiệu ứng:

- GSAP 3.12.5 + ScrollTrigger (cdnjs)
- Lenis 1.1.13 (cdnjs)
- Google Fonts: Cormorant Garamond, Poppins

Trang `lien-he.html` **không** phụ thuộc CDN nào ngoài font — biểu mẫu chạy
được kể cả khi GSAP hỏng.
