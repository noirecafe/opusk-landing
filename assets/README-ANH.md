# Trạng thái assets — cập nhật sau đợt kiểm tra

Mình đã dọn thư mục và tối ưu ảnh bạn gửi. Tổng dung lượng ảnh giảm **8.0 MB → 1.5 MB (−81%)**
mà mắt thường không phân biệt được.

- `_original/` — bản gốc chưa nén của bạn, giữ nguyên để đối chiếu
- `_unused/` — placeholder cũ + file trùng tên, không dùng nữa (xoá được nếu bạn muốn)

---

## ⚠️ 3 việc cần bạn xử lý

### 1. Logo OpusK bị mờ — nguyên nhân thật

`logo-opusk-white.png` hiện chỉ **216 × 54 px**. Trong khi trang hiển thị nó ở:

| Vị trí | Bề rộng hiển thị | Kết quả |
|---|---|---|
| Thanh nav | 96 px | Nét |
| Hero (góc trên trái) | 200–250 px | Bắt đầu mờ |
| **Leasing Enquiry** | **260–340 px** | **Mờ rõ** |
| Footer | 190 px | Hơi mờ |

Logo đang bị **phóng to gấp 1.6× kích thước gốc**, cộng thêm màn hình Retina/2× nữa
là 3.2×. Không có cách nào sửa bằng code — trình duyệt không tạo ra pixel không tồn tại.

**Cần:** logo trắng nền trong suốt, **rộng tối thiểu 1200 px**, hoặc tốt nhất là
file **`.svg`** (vector — nét ở mọi kích thước, dung lượng chỉ vài KB).

Nếu gửi SVG, đổi tên thành `logo-opusk-white.svg` rồi báo mình sửa 4 chỗ tham chiếu.

### 2. Ba icon phần Location còn là placeholder

`icon-metro.svg` · `icon-car.svg` · `icon-people.svg` — hiện đang là hình vẽ tạm.
(`icon-vifc.svg` bạn đã gửi bản thật rồi.)

### 3. Vài ảnh độ phân giải hơi thấp so với khung hiển thị

| File | Hiện tại | Khung hiển thị | Ghi chú |
|---|---|---|---|
| `leasing-aerial.jpg` | 1204 × 492 | full màn hình 16:9 | Tỉ lệ 2.45:1 quá dẹt → bị cắt mạnh phần trên/dưới. Nên gửi bản 16:9 |
| `sustain-workspace.jpg` | 678 × 576 | ~700 px trên desktop | Sát ngưỡng, màn Retina sẽ hơi mềm |
| `floorplan-plate.png` | 357 × 577 | ~420 px | Bản vẽ nhiều nét mảnh, nên có bản ≥1000 px |
| `hero-building-night.mp4` | 1152 × 768 | full màn hình | Chấp nhận được, bản 1920×1080 sẽ nét hơn |

---

## ✅ Đã xong

| File | Ghi chú |
|---|---|
| `hero-building-night.mp4` | 2.5 MB · 5 giây · 1152×768 |
| `hero-building-night.webm` | **Mình tạo thêm** — 1.8 MB, nhẹ hơn 30%, Chrome/Firefox ưu tiên dùng |
| `hero-poster.jpg` | **Mình tạo thêm** — trích từ frame thứ 1 của video. Hiện thay video trên mobile |
| `fac-01` → `fac-04` | Đã nén, giảm trung bình 84% |
| `office-tower-day.jpg` · `location-map.png` · `floorplan-*` | OK |
| Toàn bộ logo đối tác, badge chứng nhận | OK |

---

## 🔧 Cần sửa trong code trước khi chạy thật

**Link Messenger** — mở `index.html`, tìm `m.me/theopuskoffice`, thay bằng
username hoặc Page ID Facebook thật của dự án. Chưa sửa thì nút Messenger dẫn tới trang lỗi.

**Địa chỉ dự án ở Footer** — mình điền tạm *"The Metropole Thu Thiem, Thu Thiem New
Urban Area, Ho Chi Minh City"*. Bạn kiểm tra lại địa chỉ pháp lý chính xác, và cả
truy vấn Google Maps ở thuộc tính `data-src` của `#footerMap`.

---

## Quy ước đặt tên

Ảnh phải **đúng tuyệt đối tên file** dưới đây, không thêm đuôi `1`, `-1`, `-copy`:

```
hero-building-night.mp4      hero-poster.jpg
logo-opusk-white.png         favicon.png
location-map.png             icon-vifc.svg  icon-metro.svg  icon-car.svg  icon-people.svg
office-tower-day.jpg         floorplan-zoning.png  floorplan-plate.png
fac-01-ballroom.jpg          fac-02-pool.jpg  fac-03-gym.jpg  fac-04-dining.jpg
sustain-workspace.jpg        badge-bca-green-mark.png  badge-leed-gold.png
logo-sonkim-land.png         logo-quoc-loc-phat.png
logo-coteccons.png           logo-nqh-architects.png
logo-site-concepts.png       logo-evocateurs.png
leasing-aerial.jpg           logo-highgate.png
```

**Cách kiểm tra nhanh:** mở `index.html` trong Chrome → `F12` → tab *Console*.
Ảnh nào thiếu sẽ in `[OpusK] Thiếu ảnh: assets/...` và hiện ô sọc chéo trên trang.
