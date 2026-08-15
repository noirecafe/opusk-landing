# The OpusK — Phase 2 Animation Map

Bản đồ chuyển động. Viết trước khi code, dùng làm chuẩn đối chiếu khi QA.

---

## Audit kết luận

| Mục | Thực tế |
|---|---|
| Stack | HTML/CSS/JS thuần, không bundler. GSAP 3.12.5 + ScrollTrigger + Lenis 1.1.13 qua CDN |
| Section | `#home` `#location` `#office` `#facilities` `#sustainability` `#leasing` — đúng thứ tự, không đổi |
| Breakpoint CSS | mobile-first: base → 640 → 1024 → 1280 |
| Transform xung đột | `.hero__bg` `.office__bg` `.leasing__bg` có `inset:-8% 0` — giữ nguyên, parallax chạy trên chính lớp đó, không lồng transform |
| Container pin an toàn | `.office__hero` (ScrollTrigger pin) · `.hero__stage` `.sustain__stage` `.leasing__stage` (CSS sticky) |

**Chiến lược pin:** chỉ Office dùng ScrollTrigger `pin: true` — đây là sequence kể chuyện mạnh nhất, cần scrub chính xác. Ba khối còn lại dùng `position: sticky` thuần CSS. Sticky không sinh pin-spacer nên không có pin jump, không phải tính lại khi resize, và tự động vô hiệu khi breakpoint đổi.

---

## Ngôn ngữ chuyển động dùng chung

```
Reveal distance   24–60px
Image parallax    5–12%      (mobile 0–4%)
Image scale       1.00–1.08
Scrub             0.8–1.2
Reveal duration   0.8–1.4s
Stagger           0.08–0.18s
Ease mặc định     power3.out
Ease chậm sang    power2.inOut
Ease scrub        none
```

Chỉ animate `transform`, `opacity`, `clip-path`. Không đụng `width` `height` `top` `left` `margin` `padding`.

---

## 0 · Page load — Hero entrance

Timeline một lần, không gắn scroll. Tổng ~2.6s.

| # | Đối tượng | Từ → Đến | Thời lượng | Vào lúc |
|---|---|---|---|---|
| 1 | `.hero__scrim` | opacity .55 → 1 | 1.6s | 0 |
| 2 | Video nền | scale 1.06 → 1.03 | 2.4s | 0 |
| 3 | `.hero__logo` | opacity 0→1, y 16→0 | 1.0s | 0.25 |
| 4 | "THE BUSINESS" | yPercent 100→0 | 1.1s | 0.55 |
| 5 | "ADDRESS OF" | yPercent 100→0 | 1.1s | 0.68 |
| 6 | "VIFC" | opacity 0→1, y 35→0 | 1.2s | 0.86 |
| 7 | `.hero__lead` | opacity 0→1, y 24→0 | 1.0s | 1.12 |
| 8 | `.hero__scroll` | opacity 0→1 | 0.8s | 1.5 |

Mỗi dòng headline bọc trong `.ln { overflow:hidden }`, phần tử chạy là `.ln__in`.

---

## 1 · HOME — scroll

**Desktop ≥1024px** — `.hero` cao `150vh`, `.hero__stage` `position:sticky; top:0; height:100vh`.

```
trigger  #home
start    top top
end      bottom top
scrub    1
```

| Đối tượng | Từ → Đến |
|---|---|
| Video | scale 1.03 → 1 |
| `.hero__bg` | yPercent 0 → 8 |
| `.hero__content` | y 0 → -46, opacity 1 → .35 |
| `.hero__logo` | yPercent 0 → -55, opacity 1 → 0 (kết thúc ở 55%) |
| `.hero__scroll` | opacity 1 → 0 (kết thúc ở 25%) |

Mô tả giữ opacity ≥ .35 tới cuối để còn đọc được. Section Location trắng trôi đè lên hero theo luồng tài liệu tự nhiên — không dùng overlay cố định.

**Tablet 768–1023px** — không sticky. Parallax nền giảm còn yPercent 0→5.
**Mobile ≤767px** — không sticky, không parallax. Chỉ giữ entrance timeline.

---

## 2 · LOCATION — bản đồ 3D tự chạy

Ảnh bản đồ phẳng đã được thay bằng **cảnh 3D dựng bằng CSS 3D transform**
(`js/map3d.js`), cổng từ bản React/JSX gốc sang vanilla — bỏ React + ReactDOM
+ Babel standalone (≈3.2 MB JS). Thanh nav `HOME PAGE…LEASING ENQUIRY` vẽ
trong cảnh gốc đã được gỡ; nav thật của trang đảm nhiệm việc đó.

**Cảnh chạy vòng lặp 7.8 s, HOÀN TOÀN ĐỘC LẬP với thao tác cuộn** — đúng như
file gốc (`OM_PLAYBACK = {"mode":"loop"}`). Section giữ chiều cao bình thường:
không pin, không sticky, không ScrollTrigger.

### Cấu trúc DOM

```
.location                     (section thường, padding-block: --sec-y)
 └ .location__grid            (desktop: 2 cột · mobile: xếp dọc)
    ├ .location__text         — HTML thật (h2 + lead + 4 fact) → SEO đọc được
    └ .location__map3d        — host của cảnh 3D
       └ .m3__fit             — khung tham chiếu 1324×1080, transform:scale(k)
          └ .m3__persp        — perspective 1700px, origin 50% 44%, isolate
             └ cam            — rotateX / rotateZ / scale3d
                └ plane       — translate3d(-fx,-fy,0)  ← KHÔNG dùng left/top
```

`k = max(hostW/1324, hostH/1080)` (cover), cập nhật qua `ResizeObserver`.

### Timeline (thời gian tác giả, 0 → 10s)

| Cảnh | T | Xảy ra gì |
|---|---|---|
| Approach | 0 → 2.4 | Mặt bằng nằm xa, nghiêng 67°, key card trôi vào |
| Lift | 2.4 → 4.8 | Các lớp tách ra (land / ink / khối VIFC), ánh xiên quét ngang, cột skyline mọc lên |
| Focus | 4.8 → 7.4 | Máy quay đẩy tới, quầng vàng lan ở ~6s, tháp THE OPUSK mọc trên lô đất |
| Arrival | 7.4 → 10 | Đỉnh tháp sáng, màn che khép rồi mở lại, thẻ tên đáp xuống |

Thời gian phát (7.8 s) → thời gian tác giả (10 s) qua bảng `warp()`, giữ đúng
nhịp mà tác giả đặt cho từng cảnh: Approach chạy nhanh, Focus chậm lại.

Cột chữ reveal riêng khi section vào khung nhìn (`top 85%`), không liên quan
tới đồng hồ của cảnh.

### Ngân sách vẽ

- Không có thuộc tính layout nào bị ghi trong lúc chạy (đã kiểm bằng test) —
  chỉ `transform` và `opacity`.
- Dải sáng quét (`sweep` / `sheen`) dùng gradient **tĩnh** + `translateX`
  thay vì dựng lại chuỗi `linear-gradient` mỗi khung hình.
- 16 lát đùn khối VIFC chỉ được ghi lại khi `lift` đổi >0.0015.
- `requestAnimationFrame` **dừng hẳn** khi cảnh ra khỏi khung nhìn
  (`IntersectionObserver`) hoặc khi người dùng chuyển tab (`visibilitychange`).
- `mix-blend-mode` (2 lớp) chỉ bật khi `hardwareConcurrency >= 4`, và được
  cô lập bằng `isolation: isolate` để không kéo cả trang vào việc trộn lớp.
- Bản `low` (màn <768px hoặc `saveData` / mạng 2G-3G): 10 lát, không blend,
  không quầng sáng landmark.

### Dự phòng

| Tình huống | Kết quả |
|---|---|
| Không có GSAP | Cảnh vẫn chạy — `map3d.js` không phụ thuộc GSAP |
| `prefers-reduced-motion` | `autoplay: false` + `seek(5.6)` → một khung tĩnh đẹp |
| Không có JS | `<noscript>` hiện `assets/location-map.webp` |

---

## 3 · OFFICE OVERVIEW — sequence chính

**Desktop** — ScrollTrigger pin thật.

```
trigger            .office__hero
start              top top
end                +=200%
pin                true
scrub              1
anticipatePin      1
invalidateOnRefresh true
```

`.office__hero` đặt `height: 100svh` ở desktop để pin không hở. Phần tử pin **không** nhận transform trực tiếp — mọi chuyển động nằm ở con.

### Phase A — 0 → 30%: giới thiệu công trình

| Đối tượng | Từ → Đến |
|---|---|
| `.office__bg img` | scale 1.08 → 1.02 |
| "BUILT FOR BUSINESS." | yPercent 100→0 (0 → 12%) |
| "DESIGNED FOR GROWTH." | yPercent 100→0 (10% → 24%) |

### Phase B — 30 → 82%: bảng thông số

| Đối tượng | Từ → Đến |
|---|---|
| `.specs` | opacity 0→1, y 26→0 |
| Đường kẻ ô | `--line-a` 0 → .35 |
| 6 hàng `<tr>` | opacity 0→1, y 18→0, stagger đều trong khoảng |

Hàng đã hiện thì **giữ nguyên** tới hết timeline. Người dùng dừng cuộn ở bất kỳ đâu vẫn đọc trọn thông số.

### Phase C — 82 → 100%: thoát

| Đối tượng | Từ → Đến |
|---|---|
| `.office__bg` | yPercent 0 → -6 |
| `.office__inner` | y 0 → -26 |

**Tablet** — pin rút còn `+=130%`, scale nền 1.05 → 1.02.
**Mobile** — bỏ pin hoàn toàn. Tiêu đề + bảng reveal thường, `<tr>` stagger 0.06.

---

## 4 · TYPICAL FLOOR PLAN

Reveal kỹ thuật, không parallax, không xoay/méo bản vẽ.

| # | Đối tượng | Hiệu ứng |
|---|---|---|
| 1 | `.floorplan__title` | từng dòng, yPercent 100→0 |
| 2 | `.floorplan__zones` | opacity 0→1, y 30→0 |
| 3 | `.floorplan__plate` | opacity 0→1, scale 0.96→1, `clip-path inset(0 0 100% 0)` → `inset(0)` |
| 4 | `.floorplan__caption` | opacity 0→1 |
| 5 | `.areas` | opacity 0→1, x 30→0 |

Stagger giữa các bước 0.14s. Trên mobile x đổi thành y để tránh tràn ngang.

---

## 5 · FACILITIES

Giữ nguyên lưới ảnh đã duyệt. Mỗi ảnh nằm trong `.card__media { overflow:hidden }`, chỉ ảnh bên trong di chuyển.

| # | Bước |
|---|---|
| 1 | `.facilities__intro .h2` reveal từng dòng |
| 2 | `.lead` fade up |
| 3 | Ảnh lớn 01 hiện qua mask `clip-path inset(0 0 100% 0)` → `inset(0)`, 1.2s |
| 4 | Ảnh 02–04 reveal khi vào khung, stagger 0.14 |
| 5 | Caption hiện **sau** ảnh: số → tiêu đề → mô tả, stagger 0.08 |

Parallax so le (desktop, scrub 1, ảnh phóng sẵn 1.12 để không hở mép):

```
Ảnh 01   yPercent -5 →  5
Ảnh 02   yPercent  6 → -4
Ảnh 03   yPercent -4 →  6
Ảnh 04   yPercent  5 → -5
```

Tablet giảm còn ±3. Mobile tắt hẳn.

---

## 6 · SUSTAINABILITY

**Desktop** — `.sustain__split` cao `160vh`, `.sustain__stage` sticky `height:100vh`, giữ lưới 2 cột. Panel nâu bên phải đứng yên, ảnh trái chuyển động nhẹ.

```
trigger  .sustain__split
start    top top
end      bottom bottom
scrub    1
```

| Đối tượng | Từ → Đến |
|---|---|
| `.sustain__frame img` | scale 1.06 → 1, yPercent -3 → 3 |

Reveal (trigger riêng, không scrub):

| # | Đối tượng | Hiệu ứng |
|---|---|---|
| 1 | `.sustain__badges img` | opacity 0→1, scale .94→1, stagger 0.12 |
| 2 | "DESIGNED FOR" | yPercent 100→0 |
| 3 | "RESPONSIBLE BUSINESS" | yPercent 100→0, trễ 0.12 |
| 4 | `.lead` | opacity 0→1, y 24→0 |
| 5 | `.pillar` × 4 | opacity 0→1, y 20→0, stagger 0.14 |

Không pin cả section — khối Developer nằm ngay dưới.

### Developer & Partners

Nhịp chậm lại sau sequence pin.

| # | Đối tượng | Hiệu ứng |
|---|---|---|
| 1 | "DEVELOPER & INVESTOR" | opacity 0→1, y 28→0 |
| 2 | `.developer__copy` | opacity 0→1, y 24→0 — cả đoạn, không tách chữ |
| 3 | 2 logo chủ đầu tư | opacity 0→1, scale .94→1, cùng lúc |
| 4 | "IN PARTNERSHIP WITH" | opacity 0→1, y 24→0 |
| 5 | 4 logo đối tác | opacity 0→1, scale .94→1, stagger 0.12 |

Logo không animate liên tục, không scale quá 0.94→1.

---

## 7 · LEASING ENQUIRY

**Desktop** — `.leasing` cao `150vh`, `.leasing__stage` sticky `100vh`.

```
trigger  #leasing
start    top top
end      bottom top
scrub    1
```

| Đối tượng | Từ → Đến |
|---|---|
| `.leasing__bg img` | scale 1.06 → 1 |
| `.leasing__bg` | yPercent 0 → 6 |
| `.leasing__scrim` | opacity .75 → 1 |

Reveal tuần tự (`start: top 62%`):

| # | Đối tượng | Hiệu ứng | Trễ |
|---|---|---|---|
| 1 | `.leasing__logo` | opacity 0→1, y 24→0, scale .97→1 | 0 |
| 2 | `.leasing__title` | yPercent 100→0 | 0.18 |
| 3 | `.contact` #1 | opacity 0→1, y 22→0 | 0.34 |
| 4 | `.contact` #2 | opacity 0→1, y 22→0 | 0.46 |
| 5 | `.agent` | opacity 0→1, y 20→0 | 0.62 |

Không fade toàn trang về đen. Footer đã có sẵn trong layout duyệt nên giữ nguyên, chỉ thêm reveal nhẹ.

---

## Chuyển cảnh giữa các section

Dùng đúng một hệ thống:

- Section trắng trôi đè lên section ảnh theo luồng tài liệu tự nhiên (sticky + flow)
- `clip-path inset` cho bản đồ, floor plate, ảnh facilities lớn
- `overflow:hidden` + `yPercent` nhỏ cho ảnh
- Không overlay full-screen, không wipe sân khấu, không đổi màu nền đột ngột

---

## Ma trận responsive

| | Desktop ≥1024 | Tablet 768–1023 | Mobile ≤767 |
|---|---|---|---|
| Lenis | Bật | Bật | Bật, `smoothTouch: false` |
| Hero sticky | Có, 150vh | Không | Không |
| Office pin | Có, +=200% | Có, +=130% | Không |
| Sustain sticky | Có, 160vh | Không | Không |
| Leasing sticky | Có, 150vh | Không | Không |
| Parallax ảnh | 5–12% | 3–6% | 0% |
| Scrub | Có | Có (giảm) | Không |
| Reveal | Đầy đủ | Đầy đủ | Rút gọn: opacity + y 24, 0.8s |
| Stagger | 0.08–0.18 | 0.08–0.14 | 0.06–0.10 |

---

## Reduced motion

Khi `prefers-reduced-motion: reduce`:

- Lenis **không khởi tạo** — cuộn native
- Không pin, không sticky (`position: static` ghi đè), không scrub, không parallax
- Toàn bộ nội dung `opacity: 1; transform: none` ngay lập tức
- Anchor navigation vẫn chạy, dùng `scrollIntoView` với offset header
- Video hero dừng, chỉ hiện poster

---

## Điểm ScrollTrigger cần refresh

1. `document.fonts.ready` — font Cormorant đổi chiều cao dòng
2. `window load` — ảnh có kích thước thật
3. Resize (debounce 200ms) — chỉ khi bề rộng đổi, bỏ qua thay đổi chiều cao do thanh địa chỉ mobile
4. `orientationchange`
5. Đóng menu mobile
6. `pageshow` khi `persisted` — quay lại từ lịch sử trình duyệt

---

## Ngân sách hiệu năng

- `will-change` chỉ đặt lúc tween chạy, gỡ ở `onComplete`
- Không ScrollTrigger cho từng chữ cái — nhỏ nhất là một dòng
- Animation liên quan gom vào timeline chung, không tạo trigger rời
- Không pin lồng nhau
- Ảnh dưới màn hình đầu `loading="lazy"`, hero `fetchpriority="high"`
- Không dùng `filter: blur` khi scrub
- Cảnh 3D: 0 thao tác ghi thuộc tính layout trong lúc chạy

---

## Nav — trong suốt ↔ nền đặc

| Trạng thái | Nền | Chữ / logo | Kích hoạt |
|---|---|---|---|
| Đầu trang | `rgba(90,66,38,0)` + vệt tối nhẹ ở `::before` | Trắng, `text-shadow` nhẹ | mặc định |
| Đã cuộn | `rgba(90,66,38,.96)` + blur 10px + đổ bóng | Trắng, bỏ `text-shadow` | `.is-solid` |
| Menu mobile mở | `rgba(90,66,38,.98)` | Trắng | `.is-menu-open` |

Chuyển đổi 450ms `cubic-bezier(.22,.8,.28,1)`. Trạng thái được lật bởi một
**sentinel 1px** ở đầu `<body>` qua `IntersectionObserver` — không nghe sự
kiện scroll, không đọc layout mỗi khung hình.

`.is-compact` (thu chiều cao nav còn 46px) vẫn giữ, kích hoạt khi rời hero.

---

## Cụm nút nổi (FAB)

Mặc định **tất cả nút đều ẩn**. Nút toggle vàng (có nhãn "Liên hệ") bung /
thu cụm.

| Thứ tự (`--i`) | Nút | Hành động |
|---|---|---|
| 0 | Top Up | Cuộn mượt về `#home` (Lenis 1.2s) |
| 1 | Messenger | `m.me` |
| 2 | Zalo | Popover chọn người liên hệ |
| 3 | Hotline | Popover chọn người liên hệ |

- Mở: stagger từ **dưới lên**, delay `(3 − i) × 55ms`
- Đóng: stagger từ **trên xuống**, delay `i × 40ms`
- `.fab`, `.fab__item`, `.fab__btn` mặc định `pointer-events:none` — khung
  chứa rộng bằng cả nhãn tooltip nên nếu bắt sự kiện sẽ tạo dải vô hình chặn
  click ở mép phải màn hình.
- Đóng khi: bấm ra ngoài, phím `Esc`, hoặc sau khi bấm Top Up.
