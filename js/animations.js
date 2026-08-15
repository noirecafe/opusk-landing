/* ==========================================================================
   THE OPUSK — animations.js
   Phase 2 · Choreography

   Nguyên tắc bất di bất dịch:
   • Chỉ animate transform / opacity / clip-path. Không đụng layout property.
   • Một phần tử chỉ nhận đúng một tween opacity (xem hàm claim()).
   • Không transform trực tiếp lên phần tử đang bị pin.
   • Không ScrollTrigger cho từng chữ cái — đơn vị nhỏ nhất là một dòng.
   • Mọi timeline phụ thuộc layout đều bật invalidateOnRefresh.
   ========================================================================== */
(function () {
  'use strict';

  var API = window.OPUSK || {};

  /* Không có GSAP hoặc người dùng yêu cầu giảm chuyển động
     → gỡ khoá hiển thị và dừng tại đây. Trang vẫn dùng được đầy đủ.        */
  if (!API.motion) { if (API.markReady) API.markReady(); return; }

  var gsap = window.gsap;
  var ST   = window.ScrollTrigger;

  gsap.registerPlugin(ST);
  gsap.defaults({ ease: 'power3.out' });

  ST.config({ ignoreMobileResize: true });

  /* ======================================================================
     TIỆN ÍCH
     ====================================================================== */
  var q  = function (s, ctx) { return (ctx || document).querySelector(s); };
  var qa = function (s, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(s)); };

  /* Chặn hai tween opacity cùng đè lên một phần tử.
     gsap.from() ghi opacity 0 ngay lúc khởi tạo; tween thứ hai đọc giá trị
     đó làm đích → animate từ 0 về 0 và phần tử biến mất vĩnh viễn.

     Sổ đăng ký phải được LÀM MỚI mỗi lần đổi breakpoint: sau mm.revert(),
     các tween cũ đã bị huỷ nên phần tử cần được đăng ký lại. Giữ nguyên sổ
     cũ sẽ khiến mọi reveal bị bỏ qua ở breakpoint mới.                     */
  var claimed = new WeakSet();
  function resetClaims() { claimed = new WeakSet(); }
  function claim(el) {
    if (!el || claimed.has(el)) return false;
    claimed.add(el);
    return true;
  }

  /* will-change chỉ tồn tại trong lúc tween chạy. Để vĩnh viễn trên mọi ảnh
     sẽ ngốn VRAM và làm trình duyệt chậm đi thay vì nhanh hơn.              */
  function markWC(t)  { gsap.utils.toArray(t).forEach(function (e) { e.classList.add('is-animating'); }); }
  function clearWC(t) { gsap.utils.toArray(t).forEach(function (e) { e.classList.remove('is-animating'); }); }

  function wcHooks(targets) {
    return {
      onStart:    function () { markWC(targets); },
      onComplete: function () { clearWC(targets); },
      onReverseComplete: function () { clearWC(targets); }
    };
  }

  /* Đánh dấu mọi phần tử ĐANG bị animation giấu đi. Lưới an toàn bên dưới
     dùng dấu này để không bao giờ để sót chữ vô hình trên trang.            */
  function tag(list) {
    gsap.utils.toArray(list).forEach(function (n) { n.dataset.rv = '1'; });
    return list;
  }

  /* Bọc mỗi dòng (ngăn cách bởi <br>) vào .ln > .ln__in để làm mặt nạ.
     Giữ nguyên thẻ con bên trong nên class .gold / .gold-l không mất.

     KHÔNG tự ghi yPercent ở đây: trạng thái ẩn phải do chính tween ghi
     (gsap.fromTo → immediateRender) để không thể có chuyện phần tử bị giấu
     mà lại chẳng có tween nào đưa nó trở lại.                              */
  function splitLines(el) {
    if (!el) return [];
    if (el.dataset.split) return qa('.ln__in', el);

    var parts = el.innerHTML.split(/<br\s*\/?>/i)
      .map(function (p) { return p.trim(); })
      .filter(function (p) { return p.length; });

    el.innerHTML = parts.map(function (p) {
      return '<span class="ln"><span class="ln__in">' + p + '</span></span>';
    }).join('');

    el.dataset.split = '1';
    return qa('.ln__in', el);
  }

  /* Reveal chuẩn dùng lại nhiều nơi */
  function reveal(targets, opts) {
    targets = gsap.utils.toArray(targets).filter(claim);
    if (!targets.length) return null;

    opts = opts || {};
    tag(targets);
    return gsap.fromTo(targets,
      { opacity: 0, y: opts.y != null ? opts.y : 24 },
      Object.assign({
        opacity: 1, y: 0,
        duration: opts.duration || 1,
        stagger:  opts.stagger  || 0,
        delay:    opts.delay    || 0,
        scrollTrigger: {
          trigger: opts.trigger || targets[0],
          start:   opts.start   || 'top 85%',
          once:    true,
          invalidateOnRefresh: true
        }
      }, wcHooks(targets))
    );
  }

  /* Reveal tiêu đề theo từng dòng */
  function revealLines(el, opts) {
    var lines = splitLines(el);
    if (!lines.length) return null;
    opts = opts || {};
    tag(lines);

    return gsap.fromTo(lines,
      { opacity: 0, y: 22 },
      Object.assign({
        opacity: 1, y: 0,
        duration: opts.duration || 1.1,
        stagger:  opts.stagger  || 0.12,
        delay:    opts.delay    || 0,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: opts.trigger || el,
          start:   opts.start   || 'top 85%',
          once:    true,
          invalidateOnRefresh: true
        }
      }, wcHooks(lines))
    );
  }

  /* ======================================================================
     LƯỚI AN TOÀN NỘI DUNG

     Không có kịch bản nào được phép để lại chữ vô hình trên trang. Nếu một
     ScrollTrigger đo sai (font đổi muộn, ảnh lazy đẩy layout, đổi breakpoint
     giữa chừng) thì phần tử sẽ nằm ẩn vĩnh viễn — đúng loại lỗi âm thầm khó
     phát hiện nhất.

     Cách khắc phục: quét định kỳ mọi phần tử đã đánh dấu. Cái nào đã ở TRONG
     hoặc TRÊN khung nhìn mà vẫn ẩn thì ép hiện. Phần tử còn ở dưới khung nhìn
     không bị đụng tới, nên hiệu ứng gốc vẫn nguyên vẹn.
     ====================================================================== */
  function contentGuard() {
    var h = window.innerHeight;
    qa('[data-rv]').forEach(function (n) {
      var r = n.getBoundingClientRect();
      if (r.top > h * 1.02) return;                  // chưa tới lượt — để yên
      if (r.width === 0 && r.height === 0) return;   // đang ẩn bởi layout

      var hidden = (+gsap.getProperty(n, 'opacity') < 0.02) ||
                   (Math.abs(+gsap.getProperty(n, 'yPercent')) > 1);
      if (!hidden) { delete n.dataset.rv; return; }

      gsap.to(n, { opacity: 1, y: 0, yPercent: 0, duration: 0.5, ease: 'power2.out' });
      delete n.dataset.rv;
    });
  }

  var guardTimer = null;
  function guardSoon(delay) {
    clearTimeout(guardTimer);
    guardTimer = setTimeout(contentGuard, delay || 400);
  }

  window.addEventListener('load', function () { guardSoon(1200); });
  window.addEventListener('scroll', function () { guardSoon(500); }, { passive: true });
  if (API.lenis) API.lenis.on('scroll', function () { guardSoon(500); });

  /* ======================================================================
     0 · PAGE LOAD — Hero entrance
     Chạy một lần, không gắn scroll.
     ====================================================================== */
  function heroIntro() {
    var lines  = qa('.hero__title .ln__in');
    // Khai báo tường minh trạng thái đầu thay vì để GSAP suy ra từ CSS
    gsap.set(lines, { opacity: 0, y: 22 });

    var scrim  = q('.hero__scrim');
    var video  = q('.hero__video');
    var logo   = q('.hero__logo');
    var lead   = q('.hero__lead');
    var scroll = q('.hero__scroll');

    [logo, lead, scroll].forEach(claim);
    tag(lines);
    tag([logo, lead, scroll].filter(Boolean));

    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    if (scrim) tl.fromTo(scrim, { opacity: .55 }, { opacity: 1, duration: 1.6, ease: 'power2.inOut' }, 0);
    if (video) tl.fromTo(video, { scale: 1.06 }, { scale: 1.03, duration: 2.4, ease: 'power2.out' }, 0);

    if (logo) tl.fromTo(logo, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 1.0 }, 0.25);

    // Hai dòng đầu trượt lên khỏi mặt nạ
    if (lines[0]) tl.to(lines[0], { opacity: 1, y: 0, duration: 1.1 }, 0.55);
    if (lines[1]) tl.to(lines[1], { opacity: 1, y: 0, duration: 1.1 }, 0.68);

    // VIFC vào sau cùng, kiểu khác để tạo điểm nhấn
    if (lines[2]) tl.fromTo(lines[2],
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.2, ease: 'power3.out' }, 0.86);

    if (lead)   tl.fromTo(lead,   { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.0 }, 1.12);
    if (scroll) tl.fromTo(scroll, { opacity: 0 },        { opacity: 1, duration: 0.8 },       1.50);

    return tl;
  }

  /* ======================================================================
     PHẦN CHUNG — chạy ở mọi breakpoint
     ====================================================================== */
  function commonReveals(cfg) {

    /* --- 2 · LOCATION (chỉ cột chữ; cảnh 3D tự chạy, xem js/map3d.js) --- */
    revealLines(q('.location .h2'), { start: cfg.mapPin ? 'top 92%' : 'top 80%' });
    reveal('.location .lead', { y: 24, delay: 0.18, start: cfg.mapPin ? 'top 92%' : 'top 80%' });
    reveal('.location .fact', {
      y: 18, stagger: cfg.stagger,
      trigger: '.location__text',
      start: cfg.mapPin ? 'top 92%' : 'top 78%'
    });

    /* --- 4 · TYPICAL FLOOR PLAN --- */
    revealLines(q('.floorplan__title'), { start: 'top 80%' });
    reveal('.floorplan__zones', { y: 30, delay: 0.14, start: 'top 78%' });

    var plate = q('.floorplan__plate');
    if (plate && claim(plate)) {
      gsap.fromTo(plate,
        { opacity: 0, scale: 0.96, clipPath: 'inset(0 0 100% 0)' },
        Object.assign({
          opacity: 1, scale: 1, clipPath: 'inset(0 0 0% 0)',
          duration: 1.3, delay: 0.2, ease: 'power2.out',
          scrollTrigger: { trigger: plate, start: 'top 78%', once: true, invalidateOnRefresh: true }
        }, wcHooks(plate))
      );
    }

    reveal('.floorplan__caption', { y: 16, delay: 0.34, start: 'top 82%' });

    var areas = q('.areas');
    if (areas && claim(areas)) {
      gsap.fromTo(areas,
        { opacity: 0, x: cfg.horizontal ? 30 : 0, y: cfg.horizontal ? 0 : 22 },
        Object.assign({
          opacity: 1, x: 0, y: 0, duration: 1.1, delay: 0.42,
          scrollTrigger: { trigger: areas, start: 'top 84%', once: true, invalidateOnRefresh: true }
        }, wcHooks(areas))
      );
    }

    /* --- 5 · FACILITIES --- */
    revealLines(q('.facilities__intro .h2'), { start: 'top 80%' });
    reveal('.facilities__intro .lead', { y: 24, delay: 0.18, start: 'top 80%' });

    // Ảnh lớn 01 — mặt nạ mở từ dưới lên
    var wide = q('.card--wide');
    if (wide && claim(wide)) {
      gsap.timeline({
        scrollTrigger: { trigger: wide, start: 'top 84%', once: true, invalidateOnRefresh: true }
      })
      .set(wide, { opacity: 1 })
      .fromTo(q('.card__media', wide),
        { clipPath: 'inset(0 0 100% 0)' },
        { clipPath: 'inset(0 0 0% 0)', duration: 1.2, ease: 'power2.inOut' }, 0);
    }

    // Ba ảnh dưới
    qa('.facilities__row .card').forEach(function (card, i) {
      if (!claim(card)) return;
      gsap.fromTo(card,
        { opacity: 0, y: 34 },
        Object.assign({
          opacity: 1, y: 0, duration: 1.1, delay: i * cfg.stagger,
          scrollTrigger: { trigger: card, start: 'top 88%', once: true, invalidateOnRefresh: true }
        }, wcHooks(card))
      );
    });

    // Caption hiện SAU ảnh
    qa('.card').forEach(function (card) {
      var num   = q('.card__num', card);
      var title = q('.card__txt strong', card);
      var desc  = q('.card__txt em', card);
      var bits  = [num, title, desc].filter(function (b) { return b && claim(b); });
      if (!bits.length) return;

      gsap.timeline({
        scrollTrigger: { trigger: card, start: 'top 78%', once: true, invalidateOnRefresh: true }
      })
      .fromTo(num,   { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .9 }, 0)
      .fromTo(title, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .9 }, .08)
      .fromTo(desc,  { opacity: 0 },        { opacity: 1, duration: .9 },       .16);
    });

    /* --- 6 · SUSTAINABILITY --- */
    var badges = qa('.sustain__badges img').filter(claim);
    if (badges.length) {
      gsap.fromTo(badges,
        { opacity: 0, scale: .94 },
        Object.assign({
          opacity: 1, scale: 1, duration: 1.1, stagger: cfg.stagger,
          scrollTrigger: { trigger: '.sustain__badges', start: 'top 80%', once: true, invalidateOnRefresh: true }
        }, wcHooks(badges))
      );
    }

    revealLines(q('.sustain__text .h2'), { start: 'top 76%' });
    reveal('.sustain__text .lead', { y: 24, delay: 0.2, start: 'top 76%' });
    reveal('.sustain__text .pillar', { y: 20, stagger: cfg.stagger + 0.02, start: 'top 74%' });

    /* --- Developer & Partners --- */
    qa('.developer__title').forEach(function (t) { reveal(t, { y: 28, start: 'top 86%' }); });
    reveal('.developer__copy', { y: 24, delay: 0.14, start: 'top 84%' });

    // Logo chủ đầu tư: hiện cùng lúc
    var devLogos = qa('.logos--dev img').filter(claim);
    if (devLogos.length) {
      gsap.fromTo(devLogos,
        { opacity: 0, scale: .94 },
        Object.assign({
          opacity: 1, scale: 1, duration: 1.1,
          scrollTrigger: { trigger: q('.logos--dev'), start: 'top 88%', once: true, invalidateOnRefresh: true }
        }, wcHooks(devLogos))
      );
    }

    // Logo đối tác: stagger nhẹ
    var pLogos = qa('.logos--partners img').filter(claim);
    if (pLogos.length) {
      gsap.fromTo(pLogos,
        { opacity: 0, scale: .94 },
        Object.assign({
          opacity: 1, scale: 1, duration: 1, stagger: 0.12,
          scrollTrigger: { trigger: q('.logos--partners'), start: 'top 88%', once: true, invalidateOnRefresh: true }
        }, wcHooks(pLogos))
      );
    }

    /* --- 7 · LEASING --- */
    var lLogo = q('.leasing__logo');
    if (lLogo && claim(lLogo)) {
      gsap.fromTo(lLogo,
        { opacity: 0, y: 24, scale: .97 },
        Object.assign({
          opacity: 1, y: 0, scale: 1, duration: 1.2,
          scrollTrigger: { trigger: '#leasing', start: 'top 62%', once: true, invalidateOnRefresh: true }
        }, wcHooks(lLogo))
      );
    }

    revealLines(q('.leasing__title'), { trigger: '#leasing', start: 'top 62%', delay: 0.18 });
    reveal('.leasing .contact', { y: 22, stagger: 0.12, delay: 0.34, trigger: '#leasing', start: 'top 62%' });
    reveal('.leasing .agent',   { y: 20, delay: 0.74, trigger: '#leasing', start: 'top 62%' });

    /* --- FOOTER --- */
    reveal('.footer__col', { y: 22, stagger: cfg.stagger, start: 'top 92%' });
  }

  /* ======================================================================
     OFFICE — sequence kể chuyện chính
     Tách riêng vì cấu hình khác hẳn giữa desktop / tablet / mobile.
     ====================================================================== */
  function officeStory(mode) {
    var frame = q('.office__hero');
    var bgImg = q('.office__bg img');
    var inner = q('.office__inner');
    var title = q('.office__title');
    var specs = q('.specs');
    var rows  = qa('.specs tr');
    if (!frame) return;

    var titleLines = splitLines(title);
    tag(titleLines);
    tag([specs]);
    claim(specs);

    /* --- Mobile + tablet: không sticky, reveal thường --- */
    if (mode !== 'desktop') {
      gsap.fromTo(titleLines, { opacity: 0, y: 22 }, {
        opacity: 1, y: 0, duration: 1, stagger: 0.12,
        scrollTrigger: { trigger: frame, start: 'top 80%', once: true, invalidateOnRefresh: true }
      });
      gsap.fromTo(specs, { opacity: 0, y: 24 }, {
        opacity: 1, y: 0, duration: 1, delay: 0.2,
        scrollTrigger: { trigger: specs, start: 'top 84%', once: true, invalidateOnRefresh: true }
      });
      gsap.fromTo(rows, { opacity: 0, y: 18 }, {
        opacity: 1, y: 0, duration: .8, stagger: 0.06, delay: 0.3,
        scrollTrigger: { trigger: specs, start: 'top 84%', once: true, invalidateOnRefresh: true }
      });
      return;
    }

    /* --- Desktop: khối .office__scene cao 260vh, .office__hero là
       position:sticky (CSS thuần). ScrollTrigger CHỈ đọc tiến độ — không
       pin, không pinSpacing, không anticipatePin. Đây là điểm khác biệt
       quan trọng: pin thật chèn pin-spacer vào DOM và phải đo lại ở mỗi
       lần refresh, sai một nhịp là sinh khoảng trắng và giật.              */
    var scene  = q('.office__scene') || frame;
    var bgFrom = 1.08;

    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: scene,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
        invalidateOnRefresh: true
      }
    });

    // PHASE A — 0 → 30% · giới thiệu công trình
    tl.fromTo(bgImg, { scale: bgFrom }, { scale: 1.02, ease: 'none', duration: 30 }, 0);
    if (titleLines[0]) tl.fromTo(titleLines[0], { opacity: 0, y: 24 }, { opacity: 1, y: 0, ease: 'power3.out', duration: 12 }, 0);
    if (titleLines[1]) tl.fromTo(titleLines[1], { opacity: 0, y: 24 }, { opacity: 1, y: 0, ease: 'power3.out', duration: 14 }, 10);

    // PHASE B — 30 → 82% · bảng thông số
    tl.fromTo(specs, { opacity: 0, y: 26 }, { opacity: 1, y: 0, ease: 'power2.out', duration: 10 }, 30);
    tl.fromTo(rows,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, ease: 'power2.out', duration: 8, stagger: 6 }, 34);

    // PHASE C — 82 → 100% · thoát, nhường chỗ cho Floor Plan
    tl.to(q('.office__bg'), { yPercent: -6, ease: 'none', duration: 18 }, 82);
    tl.to(inner,            { y: -26,      ease: 'none', duration: 18 }, 82);
  }

  /* ======================================================================
     PARALLAX — chỉ desktop / tablet
     ====================================================================== */
  function parallax(mode) {
    var strong = mode === 'desktop';

    /* Các phần tử dưới đây do tween scrub điều khiển opacity: chúng ĐƯỢC
       PHÉP ở opacity 0 khi người dùng đã cuộn qua. Gỡ dấu để lưới an toàn
       không "cứu nhầm" và làm chúng hiện trở lại.                          */
    qa('.hero__logo, .hero__lead, .hero__scroll, .hero__content').forEach(function (n) {
      delete n.dataset.rv;
    });

    // Hero
    var hero = q('#home');
    if (hero && q('.hero__stage')) {
      var heroTl = gsap.timeline({
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 1, invalidateOnRefresh: true }
      });
      if (strong) heroTl.fromTo(q('.hero__video'), { scale: 1.03 }, { scale: 1, ease: 'none' }, 0);
      heroTl.fromTo(q('.hero__bg'), { yPercent: 0 }, { yPercent: strong ? 8 : 5, ease: 'none' }, 0);
      heroTl.to(q('.hero__content'), { y: -46, opacity: .35, ease: 'none' }, 0);

      gsap.to(q('.hero__logo'), {
        yPercent: -55, opacity: 0, ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: '55% top', scrub: 1, invalidateOnRefresh: true }
      });
      gsap.to(q('.hero__scroll'), {
        opacity: 0, ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: '25% top', scrub: 1, invalidateOnRefresh: true }
      });
    }

    // Ảnh Facilities — so le, ảnh phóng sẵn để không hở mép khi trôi
    var travel = strong ? [[-5, 5], [6, -4], [-4, 6], [5, -5]] : [[-3, 3], [3, -3], [-3, 3], [3, -3]];
    qa('.card__media').forEach(function (frame, i) {
      var img = q('img', frame);
      if (!img) return;
      var t = travel[i % travel.length];
      gsap.set(img, { scale: strong ? 1.12 : 1.08 });
      gsap.fromTo(img, { yPercent: t[0] }, {
        yPercent: t[1], ease: 'none',
        scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: 1 }
      });
    });

    // Sustainability — chỉ desktop, khi lưới 2 cột còn nguyên
    if (strong) {
      var sImg = q('.sustain__frame img');
      if (sImg) {
        var sTl = gsap.timeline({
          scrollTrigger: { trigger: '.sustain__split', start: 'top top', end: 'bottom bottom', scrub: 1, invalidateOnRefresh: true }
        });
        sTl.fromTo(sImg, { scale: 1.06, yPercent: -3 }, { scale: 1, yPercent: 3, ease: 'none' }, 0);
      }
    }

    // Leasing
    var leasing = q('#leasing');
    if (leasing && q('.leasing__stage')) {
      var lTl = gsap.timeline({
        scrollTrigger: { trigger: leasing, start: 'top top', end: 'bottom top', scrub: 1, invalidateOnRefresh: true }
      });
      lTl.fromTo(q('.leasing__bg img'), { scale: 1.06 }, { scale: 1, ease: 'none' }, 0);
      lTl.fromTo(q('.leasing__bg'), { yPercent: 0 }, { yPercent: strong ? 6 : 4, ease: 'none' }, 0);
      lTl.fromTo(q('.leasing__scrim'), { opacity: .75 }, { opacity: 1, ease: 'none' }, 0);
    }
  }

  /* ======================================================================
     KHỞI CHẠY — gsap.matchMedia lo việc dựng lại khi đổi breakpoint
     ====================================================================== */
  var mm = gsap.matchMedia();

  // Entrance chạy một lần, độc lập breakpoint
  heroIntro();

  mm.add('(min-width: 1024px)', function () {
    resetClaims();
    commonReveals({ stagger: 0.14, horizontal: true });
    officeStory('desktop');
    parallax('desktop');
  });

  mm.add('(min-width: 768px) and (max-width: 1023.98px)', function () {
    resetClaims();
    commonReveals({ stagger: 0.12, horizontal: true });
    officeStory('tablet');
    parallax('tablet');
  });

  mm.add('(max-width: 767.98px)', function () {
    resetClaims();
    commonReveals({ stagger: 0.08, horizontal: false });
    officeStory('mobile');
    // Không parallax trên mobile
  });

  /* Trạng thái khởi điểm đã được gsap.set / fromTo ghi đè xong
     → gỡ lớp .anim để CSS không còn ép opacity:0                          */
  requestAnimationFrame(function () {
    document.documentElement.classList.remove('anim');
    if (API.markReady) API.markReady();
    ST.refresh();
  });

  // Cho phép dọn dẹp từ bên ngoài (khi port sang React sau này)
  window.OPUSK.killAnimations = function () {
    mm.revert();
    ST.getAll().forEach(function (st) { st.kill(); });
  };
})();
