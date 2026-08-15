/* ==========================================================================
   THE OPUSK — map3d.js
   Location Map 3D · cổng vanilla từ bản React/JSX gốc.

   Bản gốc chạy React 18 + ReactDOM + Babel standalone (≈3.2 MB JS) và dựng
   lại vdom mỗi khung hình. Bản này giữ NGUYÊN toàn bộ hình học, thứ tự lớp,
   keyframe và easing — nhưng dựng DOM một lần rồi mỗi khung hình chỉ ghi
   transform / opacity vào tham chiếu đã cache. Không React, không Babel.

   Sân khấu tham chiếu 1324 × 1080 (đúng khung của bản gốc), scale bằng CSS
   để lấp đầy khung chứa nên mọi kích thước màn hình đều đúng tỷ lệ.

   API:  var scene = OPUSK_MAP3D.create(hostElement, { quality:'high'|'low' });
         scene.seek(T)      // T là thời gian tác giả, 0 → 10
         scene.resize();
         scene.destroy();
   ========================================================================== */
(function (global) {
  'use strict';

  /* ======================================================================
     HÌNH HỌC — px bản vẽ gốc → px bản đồ
     ====================================================================== */
  var K    = 1500 / 1304;
  var MAPW = 1500;
  var MAPH = 777 * K;

  function R(x, y, w, h) { return { x: x * K, y: y * K, w: w * K, h: h * K }; }

  var PLATE  = R(426, 286, 186, 184);   // khối masterplan VIFC
  var PANEL  = R(196,  24, 292, 183);   // thẻ key card
  var LEGEND = R(932, 456, 190, 276);
  var SITE   = { x: 504.5 * K, y: 386 * K };
  var START  = { x: MAPW * 0.39, y: MAPH * 0.56 };

  var STAGE_W = 1324, STAGE_H = 1080;

  /* ======================================================================
     BẢNG MÀU
     Đọc thẳng từ design token trong css/style.css để chỉ có MỘT nguồn sự
     thật về màu. Giá trị sau dấu phẩy là dự phòng nếu CSS chưa/không tải
     được — khớp đúng màu đã bake trong artwork PNG.
     ====================================================================== */
  var GOLD      = 'var(--gold-map,#A98A46)';
  var INK       = 'var(--map-ink,#2F2C27)';
  var PAPER     = 'var(--paper,#FAF8F3)';
  var WALL      = 'var(--map-wall,#38332B)';
  var WALL_LIT  = 'var(--map-wall-lit,#615847)';
  var WALL_DARK = 'var(--map-wall-dark,#2A251F)';
  var CARD      = 'var(--map-card,#2E2B26)';
  var SERIF     = 'var(--font-display,"Cormorant Garamond",serif)';

  /* Toà nhà lân cận — chiều cao tính bằng px bản đồ */
  var LANDMARKS = [
    { n: 'LANDMARK 81', x: 648, y: 146, h: 128 },
    { n: 'IFC 99F',     x: 553, y: 370, h: 104 },
    { n: 'BITEXCO',     x: 366, y: 463, h:  84 },
    { n: 'VIETCOMBANK', x: 383, y: 391, h:  70 },
    { n: 'MARINA IFC',  x: 430, y: 304, h:  54 },
    { n: 'NOTRE-DAME',  x: 318, y: 334, h:  40 }
  ].map(function (l) { return { n: l.n, x: l.x * K, y: l.y * K, h: l.h }; });

  var TILT = [67, 56, 46, 40];          // "cinematic"
  var PUSH = 3.6;                       // z cơ sở

  /* Mốc cảnh (authored seconds) — suy ra từ OM_SCENES của bản gốc */
  var A = 0, L = 2.4, F = 4.8, V = 7.4, END = 10, D = V + 1.9;
  var MX = (START.x + SITE.x) / 2;
  var MY = (START.y + SITE.y) / 2;

  /* Bảng đổi thời gian phát → thời gian tác giả (giữ đúng nhịp tác giả) */
  var SECTIONS = [
    { playStart: 0,   dur: 1.4, authStart: 0,   nat: 2.4 },
    { playStart: 1.4, dur: 1.3, authStart: 2.4, nat: 2.4 },
    { playStart: 2.7, dur: 2.5, authStart: 4.8, nat: 2.6 },
    { playStart: 5.2, dur: 2.6, authStart: 7.4, nat: 2.6 }
  ];
  var PLAY_TOTAL = 7.8;

  function warp(t) {
    var s = SECTIONS[SECTIONS.length - 1], i;
    for (i = 0; i < SECTIONS.length; i++) {
      if (t < SECTIONS[i].playStart + SECTIONS[i].dur) { s = SECTIONS[i]; break; }
    }
    var local = Math.min(Math.max(t - s.playStart, 0), s.dur);
    return Math.min(s.authStart + local * (s.nat / s.dur), END);
  }

  /* ======================================================================
     EASING & NỘI SUY — không cấp phát mảng trong vòng lặp khung hình
     ====================================================================== */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function eInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  }
  function eOutQuart(t) { t -= 1; return 1 - t * t * t * t; }
  function eOutBack(t) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  /* glide — nội suy nhiều mốc, ease easeInOutCubic (giống MOTION.glide) */
  function glide(t, keys, vals) {
    var n = keys.length;
    if (t <= keys[0]) return vals[0];
    if (t >= keys[n - 1]) return vals[n - 1];
    for (var i = 0; i < n - 1; i++) {
      if (t >= keys[i] && t <= keys[i + 1]) {
        var span = keys[i + 1] - keys[i];
        var local = span === 0 ? 0 : (t - keys[i]) / span;
        return vals[i] + (vals[i + 1] - vals[i]) * eInOutCubic(local);
      }
    }
    return vals[n - 1];
  }

  /* tween một đoạn */
  function tw(t, from, to, start, end, ease) {
    if (t <= start) return from;
    if (t >= end) return to;
    return from + (to - from) * ease((t - start) / (end - start));
  }
  function reveal(t, from, to, s, e) { return tw(t, from, to, s, e, eOutQuart); }
  function pop(t, from, to, s, e)    { return tw(t, from, to, s, e, eOutBack); }

  /* ---- Bảng keyframe hằng (hoisted, không cấp phát mỗi khung hình) ---- */
  var CAM_K   = [A, L, F, V, D, END];
  var RX_V    = [TILT[0], TILT[1], TILT[2], TILT[2] - 2, TILT[3], TILT[3] - 0.8];
  var RZ_V    = [-22, -13, -8, -6, -2.2, -1.4];
  var S_V     = [PUSH * 0.20, PUSH * 0.26, PUSH * 0.34, PUSH * 0.44, PUSH * 0.98, PUSH];
  var FX_V    = [START.x, START.x, START.x, MX, SITE.x, SITE.x];
  var FY_V    = [START.y, START.y, START.y, MY, SITE.y, SITE.y];
  var LIFT_K  = [A, L + 0.1, F, V + 0.5, D];
  var LIFT_V  = [0, 0, 1, 1, 0.5];
  var VEIL_K  = [V, V + 0.9, V + 1.7, V + 2.3];
  var VEIL_V  = [0, 0.8, 0.8, 0];
  var SWEEP_K = [L - 0.4, F + 0.7];
  var SWEEP_V = [-30, 132];
  var SWPA_K  = [L - 0.4, L + 0.9, F, F + 0.7];
  var SWPA_V  = [0, 0.42, 0.42, 0];
  var SHNA_K  = [0, 1.2, F + 1.0];
  var SHNA_V  = [0, 0.5, 0];
  var LEG_K   = [0, 1.4, F - 0.6, F + 0.4];
  var LEG_V   = [0, 1, 1, 0];
  var PANX_K  = [0, 3, 4.3, 5.6];
  var PANX_V  = [150, 92, 92, 26];
  var PANY_K  = [0, 3];
  var PANY_V  = [26, 0];
  var PANO_K  = [0, 1.1, 2.4, 4.3, 5.3];
  var PANO_V  = [0, 0, 1, 1, 0];
  var STEM_K  = [V + 0.3, V + 1.5];
  var STEM_V  = [1, 0];

  /* ----------------------------------------------------------------------
     Dải sáng quét (sweep / sheen)

     Bản gốc dựng lại chuỗi linear-gradient mỗi khung hình → trình duyệt phải
     VẼ LẠI cả lớp 1500×894 có mix-blend-mode, 60 lần/giây. Ở đây gradient là
     TĨNH (dải nằm giữa) và ta chỉ translateX — kết quả hình học y hệt nhưng
     chỉ tốn một phép composite.

     Với linear-gradient(θ), hướng gradient là (sinθ, −cosθ) và chiều dài
     đường gradient L = |w·sinθ| + |h·cosθ|. Đẩy dải đi Δ dọc hướng đó tương
     đương translateX = Δ / sinθ (thành phần vuông góc trượt dọc chính dải
     nên không nhìn thấy).
     ---------------------------------------------------------------------- */
  function bandShift(angleDeg) {
    var r = angleDeg * Math.PI / 180;
    var sn = Math.abs(Math.sin(r)), cs = Math.abs(Math.cos(r));
    var Lg = MAPW * sn + MAPH * cs;
    return (Lg / 100) / Math.sin(r);      // px translateX cho mỗi 1% dịch dải
  }
  var SWEEP_SHIFT = bandShift(108);
  var SHEEN_SHIFT = bandShift(102);

  /* ======================================================================
     TIỆN ÍCH DOM
     ====================================================================== */
  function el(tag, css, cls) {
    var n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (cls) n.className = cls;
    return n;
  }
  function img(src, css) {
    var n = document.createElement('img');
    n.src = src; n.alt = ''; n.decoding = 'async'; n.draggable = false;
    n.style.cssText = css || '';
    return n;
  }
  var ABS = 'position:absolute;';
  var P3D = 'transform-style:preserve-3d;';

  /* ======================================================================
     KHỐI ĐÙN — bốn vách + nắp, dựng ở chiều cao tham chiếu rồi scaleY
     (tránh đổi height mỗi khung hình → không reflow)
     ====================================================================== */
  function Volume(w, d, H, rot, glazed, capColor) {
    var g = el('div', ABS + 'left:0;top:0;width:0;height:0;' + P3D);

    var front = glazed
      ? 'repeating-linear-gradient(90deg,rgba(169,138,70,.5) 0 1px,rgba(0,0,0,0) 1px 6px),' +
        'linear-gradient(180deg,' + WALL_LIT + ' 0%,' + WALL + ' 78%,' + WALL_DARK + ' 100%)'
      : 'linear-gradient(180deg,' + WALL_LIT + ',' + WALL + ')';
    var back = glazed
      ? 'repeating-linear-gradient(90deg,rgba(169,138,70,.26) 0 1px,rgba(0,0,0,0) 1px 6px),' +
        'linear-gradient(180deg,' + WALL + ' 0%,' + WALL_DARK + ' 100%)'
      : 'linear-gradient(180deg,' + WALL + ',' + WALL_DARK + ')';

    var edge = 'inset 1px 0 0 rgba(201,168,98,.55),inset -1px 0 0 rgba(201,168,98,.3)';

    function wall(fw, extra, bg, lit) {
      var n = el('div', ABS + 'left:' + (-fw / 2) + 'px;top:' + (-H) + 'px;width:' + fw + 'px;height:' + H + 'px;' +
        'transform-origin:50% 100%;background:' + bg + ';backface-visibility:hidden;' +
        (lit ? 'box-shadow:' + edge + ';' : ''));
      n.dataset.extra = extra;
      g.appendChild(n);
      return n;
    }

    var walls = [
      wall(w, 'translateY(' + (d / 2) + 'px) rotateX(-90deg)', front, glazed),
      wall(w, 'translateY(' + (-d / 2) + 'px) rotateX(-90deg)', back, false),
      wall(d, 'translateX(' + (w / 2) + 'px) rotateZ(90deg) rotateX(-90deg)', back, false),
      wall(d, 'translateX(' + (-w / 2) + 'px) rotateZ(90deg) rotateX(-90deg)', front, glazed)
    ];

    var cap = el('div', ABS + 'left:' + (-w / 2) + 'px;top:' + (-d / 2) + 'px;width:' + w + 'px;height:' + d + 'px;' +
      'background:' + (capColor || INK) + ';');
    g.appendChild(cap);

    return {
      node: g,
      set: function (h, base) {
        if (h <= 0.6) { g.style.visibility = 'hidden'; return; }
        g.style.visibility = '';
        g.style.transform = 'translateZ(' + base + 'px) rotateZ(' + rot + 'deg)';
        var k = h / H;
        for (var i = 0; i < 4; i++) {
          walls[i].style.transform = walls[i].dataset.extra + ' scaleY(' + k + ')';
        }
        cap.style.transform = 'translateZ(' + h + 'px)';
      }
    };
  }

  /* ======================================================================
     DỰNG CẢNH
     ====================================================================== */
  function create(host, opts) {
    opts = opts || {};
    var hi = opts.quality !== 'low';
    var base = opts.base || 'assets/map/';
    var COURSES = hi ? 16 : 10;

    /* mix-blend-mode buộc trình duyệt trộn lớp với nền phía sau ở mỗi khung
       hình và thường phá vỡ việc thăng cấp layer của cả nhánh con. Chỉ bật
       trên máy đủ khoẻ; máy yếu vẫn có đủ cảnh, chỉ thiếu hai vệt sáng.    */
    var rich = hi && (navigator.hardwareConcurrency || 4) >= 4;
    var res = function (n) { return base + n + '.webp'; };

    host.classList.add('m3');

    var fit = el('div', ABS + 'left:50%;top:50%;width:' + STAGE_W + 'px;height:' + STAGE_H + 'px;' +
      'margin:' + (-STAGE_H / 2) + 'px 0 0 ' + (-STAGE_W / 2) + 'px;transform-origin:50% 50%;');
    fit.className = 'm3__fit';

    var persp = el('div', ABS + 'inset:0;overflow:hidden;isolation:isolate;' +
      'perspective:1700px;perspective-origin:50% 44%;');
    persp.className = 'm3__persp';

    var cam = el('div', ABS + 'left:50%;top:55%;width:0;height:0;' + P3D +
      'transform-origin:0 0;will-change:transform;');

    /* Khung máy quay dịch bằng transform, KHÔNG bằng left/top: ghi left/top
       mỗi khung hình sẽ bắt trình duyệt tính lại layout 60 lần/giây.       */
    var plane = el('div', ABS + 'left:0;top:0;width:' + MAPW + 'px;height:' + MAPH + 'px;' + P3D +
      'will-change:transform;');

    /* --- 1 · vùng sáng ấm nền dưới artwork --- */
    var pool = el('div', ABS + 'left:' + (MAPW * 0.08) + 'px;top:' + (MAPH * 0.02) + 'px;' +
      'width:' + (MAPW * 0.86) + 'px;height:' + (MAPH * 0.96) + 'px;transform:translateZ(-4px);' +
      'background:radial-gradient(closest-side,rgba(190,166,120,.18),rgba(190,166,120,0) 74%);');

    /* --- 2 · nền đất ---
       Toàn bộ ảnh của cảnh nằm dưới màn hình đầu: lazy + fetchpriority thấp
       để không tranh băng thông với video/poster hero (LCP).                */
    var paper = img(res('paper'), ABS + 'left:0;top:0;width:' + MAPW + 'px;height:' + MAPH + 'px;');
    paper.loading = 'lazy'; paper.fetchPriority = 'low';

    /* --- 3 · bóng tiếp xúc --- */
    var inkShadow = img(res('ink-shadow'), ABS + 'left:0;top:0;width:' + MAPW + 'px;height:' + MAPH + 'px;');
    inkShadow.loading = 'lazy'; inkShadow.fetchPriority = 'low';
    var opuskShadow = img(res('opusk-shadow'), ABS + 'left:' + PLATE.x + 'px;top:' + PLATE.y + 'px;' +
      'width:' + PLATE.w + 'px;height:' + PLATE.h + 'px;');
    opuskShadow.loading = 'lazy'; opuskShadow.fetchPriority = 'low';

    /* --- 4 · ánh nước & ánh xiên (chỉ bản chất lượng cao) ---
       Cấu trúc: vỏ ngoài mang mặt nạ + cắt biên (đứng yên) → ruột bên trong
       mang dải sáng tĩnh và chỉ translateX.                                */
    var sheen = null, sheenBand = null, sweep = null, sweepBand = null;

    function lightLayer(maskName, angle, rgb, half) {
      var shell = el('div', ABS + 'left:0;top:0;width:' + MAPW + 'px;height:' + MAPH + 'px;' +
        'pointer-events:none;mix-blend-mode:screen;overflow:hidden;opacity:0;' +
        '-webkit-mask-image:url(' + res(maskName) + ');mask-image:url(' + res(maskName) + ');' +
        '-webkit-mask-size:100% 100%;mask-size:100% 100%;');
      var band = el('div', ABS + 'left:0;top:0;width:100%;height:100%;will-change:transform;' +
        'background:linear-gradient(' + angle + 'deg,' +
        'rgba(' + rgb + ',0) ' + (50 - half) + '%,' +
        'rgba(' + rgb + ',.9) 50%,' +
        'rgba(' + rgb + ',0) ' + (50 + half) + '%);');
      shell.appendChild(band);
      return [shell, band];
    }

    if (rich) {
      var a = lightLayer('water', 102, '255,251,240', 16);
      sheen = a[0]; sheenBand = a[1];
      var b = lightLayer('paper', 108, '255,244,214', 24);
      sweep = b[0]; sweepBand = b[1];
    }

    /* --- 5 · đường phố, chữ, ký hiệu --- */
    var ink = img(res('ink'), ABS + 'left:0;top:0;width:' + MAPW + 'px;height:' + MAPH + 'px;');
    ink.loading = 'lazy'; ink.fetchPriority = 'low';

    /* --- 6 · khối VIFC đùn lên --- */
    var plate = el('div', ABS + 'left:0;top:0;width:' + MAPW + 'px;height:' + MAPH + 'px;' + P3D);
    var slabs = [];
    for (var i = 0; i < COURSES; i++) {
      var s = img(res(i === COURSES - 1 ? 'opusk-wall-lit' : 'opusk-wall'),
        ABS + 'left:' + PLATE.x + 'px;top:' + PLATE.y + 'px;width:' + PLATE.w + 'px;height:' + PLATE.h + 'px;');
      s.loading = 'lazy';
      slabs.push(s);
      plate.appendChild(s);
    }
    var opuskTop = img(res('opusk'), ABS + 'left:' + PLATE.x + 'px;top:' + PLATE.y + 'px;' +
      'width:' + PLATE.w + 'px;height:' + PLATE.h + 'px;');
    plate.appendChild(opuskTop);

    /* --- 7 · lô đất THE OPUSK --- */
    var site = el('div', ABS + 'left:' + SITE.x + 'px;top:' + SITE.y + 'px;width:0;height:0;' + P3D);

    var glow = el('div', ABS + 'left:-110px;top:-110px;width:220px;height:220px;' +
      'background:radial-gradient(closest-side,rgba(169,138,70,.42),rgba(169,138,70,0) 70%);opacity:0;');
    site.appendChild(glow);

    var rings = [];
    for (var r = 0; r < 2; r++) {
      var ring = el('div', ABS + 'left:-95px;top:-95px;width:190px;height:190px;border-radius:50%;' +
        'border:1.5px solid ' + GOLD + ';opacity:0;');
      rings.push(ring); site.appendChild(ring);
    }

    var podium = Volume(17, 17, 9,  -38, false, '#413A31');
    var tower  = Volume(9.5, 9.5, 38, -38, true,  '#2B2621');
    var crown  = Volume(5, 5, 9,   -38, false, GOLD);
    site.appendChild(podium.node); site.appendChild(tower.node); site.appendChild(crown.node);

    var crownLight = el('div', ABS + 'left:-30px;top:-30px;width:60px;height:60px;' +
      'background:radial-gradient(closest-side,rgba(214,180,104,.85),rgba(169,138,70,0) 72%);opacity:0;');
    site.appendChild(crownLight);
    plate.appendChild(site);

    /* --- 8 · cột skyline --- */
    var stems = LANDMARKS.map(function (p) {
      var g = el('div', ABS + 'left:' + p.x + 'px;top:' + p.y + 'px;width:0;height:0;' + P3D +
        'transform:translateZ(26px);opacity:0;');
      var halo = rich ? el('div', ABS + 'left:-90px;top:-90px;width:180px;height:180px;border-radius:50%;' +
        'border:1px solid ' + GOLD + ';opacity:0;') : null;
      if (halo) g.appendChild(halo);

      var bar = el('div', ABS + 'left:-.7px;top:' + (-p.h) + 'px;width:1.4px;height:' + p.h + 'px;' +
        'transform-origin:50% 100%;transform:rotateX(-90deg) scaleY(0);' +
        'background:linear-gradient(to top,rgba(169,138,70,.06),' + GOLD + ');');
      g.appendChild(bar);

      var dot = el('div', ABS + 'left:-2.5px;top:-2.5px;width:5px;height:5px;border-radius:50%;' +
        'background:' + GOLD + ';');
      g.appendChild(dot);

      var burst = rich ? el('div', ABS + 'left:-34px;top:-34px;width:68px;height:68px;opacity:0;' +
        'background:radial-gradient(closest-side,rgba(214,180,104,.9),rgba(169,138,70,0) 70%);') : null;
      if (burst) g.appendChild(burst);

      plate.appendChild(g);
      return { p: p, g: g, halo: halo, bar: bar, dot: dot, burst: burst };
    });

    /* --- 9 · chú giải tiện ích --- */
    var legend = img(res('legend'), ABS + 'left:' + LEGEND.x + 'px;top:' + LEGEND.y + 'px;' +
      'width:' + LEGEND.w + 'px;height:' + LEGEND.h + 'px;opacity:0;');
    legend.loading = 'lazy';

    /* --- 10 · thẻ key card --- */
    var panelBox = el('div', ABS + 'left:' + PANEL.x + 'px;top:' + PANEL.y + 'px;' +
      'width:' + PANEL.w + 'px;height:' + PANEL.h + 'px;opacity:0;');
    var panelImg = img(res('panel'), ABS + 'inset:0;width:100%;height:100%;clip-path:inset(4px);');
    panelImg.loading = 'lazy';
    panelBox.appendChild(panelImg);

    /* thứ tự lớp đúng như bản gốc */
    plane.appendChild(pool);
    plane.appendChild(paper);
    plane.appendChild(inkShadow);
    plane.appendChild(opuskShadow);
    if (sheen) plane.appendChild(sheen);
    if (sweep) plane.appendChild(sweep);
    plane.appendChild(ink);
    plane.appendChild(plate);
    plane.appendChild(legend);
    plane.appendChild(panelBox);

    cam.appendChild(plane);
    persp.appendChild(cam);

    /* --- màn che tiêu điểm (không gian màn hình) --- */
    var veil = el('div', ABS + 'inset:0;pointer-events:none;opacity:0;' +
      'background:radial-gradient(46% 52% at 50% 50%,rgba(250,248,243,0) 34%,' + PAPER + ' 100%);');
    persp.appendChild(veil);

    /* --- thẻ tên công trình --- */
    var label = el('div', ABS + 'left:50%;top:55%;width:0;height:0;opacity:0;');
    label.className = 'm3__label';
    var card = el('div', ABS + 'left:0;top:0;transform:translate(-50%,-100%);' +
      'padding:18px 36px 20px;background:' + CARD + ';white-space:nowrap;' +
      'box-shadow:0 30px 56px rgba(47,44,39,.28);');
    var cardName = el('div', 'font-family:' + SERIF + ';font-weight:500;font-size:34px;line-height:1;' +
      'letter-spacing:var(--ls-wider,.15em);color:#F3EEE2;');
    cardName.textContent = 'THE OPUSK';
    var cardRule = el('div', 'height:1px;background:rgba(169,138,70,.75);margin:13px 0 11px;');
    var cardSub = el('div', 'font-family:' + SERIF + ';font-weight:500;font-size:15px;line-height:1;' +
      'letter-spacing:.3em;color:' + GOLD + ';');
    cardSub.textContent = 'VIFC · THU THIEM';
    card.appendChild(cardName); card.appendChild(cardRule); card.appendChild(cardSub);
    var tail = el('div', ABS + 'left:-.5px;top:0;width:1px;height:66px;' +
      'background:linear-gradient(to bottom,' + GOLD + ',rgba(169,138,70,0));');
    label.appendChild(card); label.appendChild(tail);
    persp.appendChild(label);

    fit.appendChild(persp);
    host.appendChild(fit);

    /* ====================================================================
       SCALE ĐỂ LẤP KHUNG CHỨA
       ==================================================================== */
    var scale = 1;
    function resize() {
      var w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      var k = Math.max(w / STAGE_W, h / STAGE_H);
      if (Math.abs(k - scale) < 0.001) return;
      scale = k;
      fit.style.transform = 'scale(' + k + ')';
    }
    resize();

    var ro = null;
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(resize);
      ro.observe(host);
    } else {
      window.addEventListener('resize', resize, { passive: true });
    }

    /* ====================================================================
       SEEK — ghi trạng thái cho một thời điểm T
       ==================================================================== */
    var lastT = -1, lastLift = -999;

    function seek(T) {
      T = clamp(T, 0, END);
      if (T === lastT) return;
      lastT = T;

      /* --- máy quay --- */
      var wob  = Math.sin(T * 0.5) * 0.8;
      var rx   = glide(T, CAM_K, RX_V);
      var rz   = glide(T, CAM_K, RZ_V) + wob * 0.3;
      var s    = glide(T, CAM_K, S_V);
      var fx   = glide(T, CAM_K, FX_V);
      var fy   = glide(T, CAM_K, FY_V);
      var lift = glide(T, LIFT_K, LIFT_V);
      var liftC = clamp(lift, 0, 1);
      var bloom = clamp(reveal(T, 0, 1, F - 0.4, F + 1.1), 0, 1);

      cam.style.transform = 'rotateX(' + rx + 'deg) rotateZ(' + rz + 'deg) scale3d(' + s + ',' + s + ',' + s + ')';
      plane.style.transform = 'translate3d(' + (-fx) + 'px,' + (-fy) + 'px,0)';

      var face = 'rotateZ(' + (-rz) + 'deg) rotateX(' + (-rx) + 'deg)';

      /* --- lớp nền --- */
      pool.style.opacity = liftC;
      inkShadow.style.transform = 'translateZ(0.4px) translate(' + (5 * lift) + 'px,' + (8 * lift) + 'px)';
      inkShadow.style.opacity = 0.34 * liftC;
      opuskShadow.style.transform = 'translateZ(0.8px) translate(' + (10 * lift) + 'px,' + (14 * lift) + 'px)';
      opuskShadow.style.opacity = 0.4 * liftC;
      ink.style.transform = 'translateZ(' + (26 * lift) + 'px)';

      /* --- ánh nước + ánh xiên --- */
      if (sheen) {
        var sa = glide(T, SHNA_K, SHNA_V);
        if (sa > 0.01) {
          var sh = ((T * 0.17) % 1) * 150 - 25;
          sheen.style.transform = 'translateZ(' + (3 * lift) + 'px)';
          sheenBand.style.transform = 'translateX(' + ((sh - 50) * SHEEN_SHIFT) + 'px)';
          sheen.style.opacity = sa;
        } else if (sheen.style.opacity !== '0') { sheen.style.opacity = 0; }
      }
      if (sweep) {
        if (T > L - 0.4 && T < F + 0.7) {
          var sw = glide(T, SWEEP_K, SWEEP_V);
          sweep.style.transform = 'translateZ(' + (27 * lift) + 'px)';
          sweepBand.style.transform = 'translateX(' + ((sw - 50) * SWEEP_SHIFT) + 'px)';
          sweep.style.opacity = glide(T, SWPA_K, SWPA_V);
        } else if (sweep.style.opacity !== '0') { sweep.style.opacity = 0; }
      }

      /* --- khối VIFC ---
         16 lát đùn chỉ phụ thuộc `lift`. Ghi lại cả 16 transform mỗi khung
         hình là lãng phí: chỉ viết khi lift đổi đủ để mắt thấy được.       */
      plate.style.transform = 'translateZ(' + (26 * lift) + 'px)';
      var EXT = 20 * lift, FOOT = -26 * lift;
      if (Math.abs(lift - lastLift) > 0.0015) {
        lastLift = lift;
        var span = EXT - FOOT, denom = COURSES - 1;
        for (var i = 0; i < COURSES; i++) {
          slabs[i].style.transform = 'translateZ(' + (FOOT + span * (i / denom)) + 'px)';
        }
      }
      opuskTop.style.transform = 'translateZ(' + EXT + 'px)';
      site.style.transform = 'translateZ(' + EXT + 'px)';

      /* --- khối tháp --- */
      var grow = clamp(reveal(T, 0, 1, F - 0.2, V + 0.5), 0, 1);
      var hP = 9 * grow, hT = 38 * grow;
      var hC = 9 * clamp(pop(T, 0, 1, V - 0.5, V + 0.9), 0, 1);
      podium.set(hP, 0);
      tower.set(hT, hP);
      crown.set(hC, hP + hT);

      glow.style.opacity = bloom;
      for (var r2 = 0; r2 < 2; r2++) {
        var pr = (T * 0.6 + r2 * 0.5) % 1;
        rings[r2].style.transform = 'scale(' + (0.22 + pr * 1.55) + ')';
        rings[r2].style.opacity = (1 - pr) * 0.7 * bloom;
      }

      var top = hP + hT + hC;
      crownLight.style.transform = 'translateZ(' + (top + 2) + 'px) ' + face;
      crownLight.style.opacity = clamp(reveal(T, 0, 1, V + 0.9, V + 1.9), 0, 1);

      /* --- cột skyline --- */
      var stemFade = glide(T, STEM_K, STEM_V);
      for (var j = 0; j < stems.length; j++) {
        var st = stems[j];
        if (stemFade <= 0.01) { st.g.style.opacity = 0; continue; }
        var g0 = clamp(pop(T, 0, 1, L - 0.2 + j * 0.12, L + 1.3 + j * 0.12), 0, 1);
        var h = st.p.h * lift * g0;
        var wave = clamp((T - (5.55 + j * 0.14)) / 1.5, 0, 1);
        var bell = Math.sin(wave * Math.PI);

        st.g.style.opacity = g0 * stemFade;
        st.bar.style.transform = 'rotateX(-90deg) scaleY(' + (h / st.p.h) + ')';
        st.bar.style.opacity = 0.75 + bell * 0.25;
        st.dot.style.transform = 'translateZ(' + h + 'px) ' + face;
        if (st.halo) {
          if (bell > 0.01) {
            st.halo.style.transform = 'scale(' + (0.2 + wave * 1.8) + ')';
            st.halo.style.opacity = bell * 0.55;
          } else if (st.halo.style.opacity !== '0') st.halo.style.opacity = 0;
        }
        if (st.burst) {
          if (bell > 0.01) {
            st.burst.style.transform = 'translateZ(' + h + 'px) ' + face + ' scale(' + (0.5 + bell * 0.9) + ')';
            st.burst.style.opacity = bell * 0.8;
          } else if (st.burst.style.opacity !== '0') st.burst.style.opacity = 0;
        }
      }

      /* --- chú giải + key card --- */
      legend.style.transform = 'translateZ(' + (44 * lift) + 'px)';
      legend.style.opacity = glide(T, LEG_K, LEG_V);

      panelBox.style.transform = 'translateZ(' + (150 * lift) + 'px) translate(' +
        glide(T, PANX_K, PANX_V) + 'px,' + glide(T, PANY_K, PANY_V) + 'px)';
      panelBox.style.opacity = glide(T, PANO_K, PANO_V);

      /* --- màn che + thẻ tên --- */
      veil.style.opacity = glide(T, VEIL_K, VEIL_V);

      var lin = clamp(pop(T, 0, 1, V + 1.5, V + 2.4), 0, 1);
      label.style.opacity = lin;
      if (lin > 0.001) {
        label.style.transform = 'translate(-50%,' + (-232 - 26 * lin) + 'px) scale(' + (0.92 + 0.08 * lin) + ')';
      }
    }

    seek(0);

    /* ====================================================================
       ĐỒNG HỒ PHÁT — vòng lặp liên tục 7.8s, đúng như bản gốc
       (OM_PLAYBACK = {"mode":"loop"}).

       Dừng hẳn requestAnimationFrame khi cảnh khuất khỏi khung nhìn hoặc khi
       người dùng chuyển tab: không có lý do gì để đốt CPU cho thứ không ai
       nhìn, và đây là nguyên nhân giật số một khi cuộn ở phần khác của trang.
       ==================================================================== */
    var raf = null, clock = 0, origin = 0, running = false;
    var visible = false, tabOn = true;

    function now() {
      return (window.performance && performance.now) ? performance.now() : Date.now();
    }

    function frame(t) {
      if (!running) return;
      clock = ((t - origin) / 1000) % PLAY_TOTAL;
      seek(warp(clock));
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running || !visible || !tabOn) return;
      running = true;
      origin = now() - clock * 1000;
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    }

    function onVisibility() {
      tabOn = !document.hidden;
      tabOn ? start() : stop();
    }

    var io = null;
    var autoplay = opts.autoplay !== false;

    if (autoplay) {
      document.addEventListener('visibilitychange', onVisibility);
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver(function (entries) {
          visible = entries[0].isIntersecting;
          visible ? start() : stop();
        }, { threshold: 0.01 });
        io.observe(host);
      } else {
        visible = true;
        start();
      }
    }

    return {
      node: host,
      seek: seek,
      play: function () { visible = true; start(); },
      pause: stop,
      resize: resize,
      warp: warp,
      duration: PLAY_TOTAL,
      authoredTotal: END,
      destroy: function () {
        stop();
        if (io) io.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
        host.innerHTML = '';
        host.classList.remove('m3');
      }
    };
  }

  global.OPUSK_MAP3D = { create: create, warp: warp, duration: PLAY_TOTAL, authoredTotal: END };

})(window);
