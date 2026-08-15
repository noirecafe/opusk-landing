/* ==========================================================================
   THE OPUSK — core.js
   Phase 2 · Nền tảng chuyển động

   Trách nhiệm:
   1. Xác định chế độ chuyển động (đầy đủ / giảm / không có GSAP)
   2. Khởi tạo Lenis DUY NHẤT MỘT LẦN và đồng bộ với ScrollTrigger
   3. Điều phối các thời điểm cần ScrollTrigger.refresh()
   4. Cung cấp API dùng chung qua window.OPUSK

   File này phải chạy TRƯỚC ui.js và animations.js.
   ========================================================================== */
(function () {
  'use strict';

  var doc  = document.documentElement;
  var body = document.body;

  /* ======================================================================
     1 · CHẾ ĐỘ CHUYỂN ĐỘNG
     ====================================================================== */
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduced  = mqReduce.matches;
  var hasGSAP  = typeof window.gsap !== 'undefined' &&
                 typeof window.ScrollTrigger !== 'undefined';
  var hasLenis = typeof window.Lenis !== 'undefined';

  // Chuyển động đầy đủ chỉ khi: người dùng không yêu cầu giảm + GSAP đã tải
  var motion = !reduced && hasGSAP;

  if (!motion) doc.classList.remove('anim');

  /* Lưới an toàn: nếu animations.js không báo sẵn sàng trong 3 giây
     (lỗi JS, CDN chậm, script bị chặn) thì gỡ .anim để nội dung hiện ra.
     Trang không bao giờ được phép trắng vĩnh viễn vì animation hỏng.        */
  var readyGuard = setTimeout(function () {
    if (!window.OPUSK.ready) {
      doc.classList.remove('anim');
      console.warn('[OpusK] animations.js chưa sẵn sàng sau 3s — đã hiện toàn bộ nội dung.');
    }
  }, 3000);

  /* LƯỚI AN TOÀN CỨNG — độc lập hoàn toàn với GSAP.

     Gỡ .anim mới chỉ xử lý được trạng thái ẩn do CSS. Nếu GSAP đã kịp ghi
     opacity:0 vào inline style rồi mới hỏng giữa chừng, dòng chữ sẽ nằm ẩn
     vĩnh viễn — đây chính là lỗi làm mất tiêu đề các section.

     Sau 5 giây, quét mọi dòng tiêu đề ĐANG NẰM TRONG khung nhìn: cái nào vẫn
     trong suốt thì ép hiện. Dòng còn ở dưới khung nhìn không bị đụng tới nên
     hiệu ứng cuộn vẫn nguyên vẹn. Chạy lại lần nữa ở giây thứ 12 để bắt cả
     trường hợp font hoặc ảnh tải rất chậm.                                  */
  function hardGuard() {
    var vh = window.innerHeight;
    var list = document.querySelectorAll('.ln__in');
    for (var i = 0; i < list.length; i++) {
      var n = list[i];
      var r = n.getBoundingClientRect();
      if (r.top > vh) continue;                       // chưa tới lượt
      if (parseFloat(getComputedStyle(n).opacity) >= 0.02) continue;
      n.style.setProperty('opacity', '1', 'important');
      n.style.setProperty('transform', 'none', 'important');
      console.warn('[OpusK] Lưới an toàn đã ép hiện một dòng tiêu đề bị ẩn.');
    }
  }
  setTimeout(hardGuard, 5000);
  setTimeout(hardGuard, 12000);

  /* ======================================================================
     2 · LENIS — khởi tạo một lần duy nhất
     ====================================================================== */
  var lenis = null;

  if (!reduced && hasLenis) {
    lenis = new window.Lenis({
      // 1.05s + easing expo: mượt nhưng không có độ trễ cảm nhận được
      duration: 1.05,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      // Giữ nguyên cuộn native trên cảm ứng — iOS/Android có quán tính
      // riêng đã tốt, ép Lenis vào chỉ gây trễ và tốn pin.
      smoothTouch: false,
      touchMultiplier: 1.6,
      wheelMultiplier: 1
    });

    if (hasGSAP) {
      // Đồng bộ hai chiều: Lenis điều khiển scroll, ScrollTrigger đọc theo
      lenis.on('scroll', window.ScrollTrigger.update);
      window.gsap.ticker.add(tick);
      window.gsap.ticker.lagSmoothing(0);
    } else {
      requestAnimationFrame(rafLoop);
    }
  }

  function tick(time) { lenis.raf(time * 1000); }
  function rafLoop(t) { lenis.raf(t); requestAnimationFrame(rafLoop); }

  /* ======================================================================
     3 · CUỘN TỚI PHẦN TỬ — bù chiều cao header
     ====================================================================== */
  function navHeight() {
    var nav = document.getElementById('nav');
    return nav ? nav.offsetHeight : 0;
  }

  function scrollToEl(el, immediate) {
    if (!el) return;
    var offset = -(navHeight() - 1);

    if (lenis) {
      lenis.scrollTo(el, { offset: offset, immediate: !!immediate });
      return;
    }
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.pageYOffset + offset,
      behavior: (reduced || immediate) ? 'auto' : 'smooth'
    });
  }

  /* ======================================================================
     4 · ĐIỀU PHỐI ScrollTrigger.refresh()

     Mọi mốc scroll đều phụ thuộc chiều cao thật của nội dung. Chiều cao đó
     thay đổi khi: font hoán đổi, ảnh tải xong, viewport đổi. Không refresh
     đúng lúc là nguyên nhân số một gây pin jump.
     ====================================================================== */
  var refreshTimer = null;

  function refresh(reason) {
    if (!hasGSAP) return;
    window.ScrollTrigger.refresh();
    if (window.OPUSK.debug) console.log('[OpusK] ScrollTrigger.refresh —', reason || '');
  }

  function refreshSoon(reason, delay) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function () { refresh(reason); }, delay || 200);
  }

  if (hasGSAP) {

    // a · Font đổi → chiều cao dòng đổi
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { refreshSoon('fonts.ready', 60); });
    }

    // b · Ảnh có kích thước thật
    window.addEventListener('load', function () { refreshSoon('window.load', 60); });

    // c · Resize — CHỈ khi bề rộng đổi.
    //     Trên mobile, ẩn/hiện thanh địa chỉ làm đổi chiều cao viewport liên
    //     tục; refresh theo chiều cao sẽ khiến ảnh giật từng nấc khi cuộn.
    var lastW = window.innerWidth;
    window.addEventListener('resize', function () {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      refreshSoon('resize', 220);
    }, { passive: true });

    // d · Xoay màn hình
    window.addEventListener('orientationchange', function () {
      refreshSoon('orientationchange', 320);
    }, { passive: true });

    // e · Quay lại từ lịch sử trình duyệt (bfcache)
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) refreshSoon('pageshow(persisted)', 120);
    });

    /* f · Ảnh lazy-load KHÔNG cần refresh nữa.

       Trước đây mỗi ảnh lazy tải xong đều gọi ScrollTrigger.refresh(). Với
       ~20 ảnh, refresh nổ liên tục ĐÚNG LÚC người dùng đang cuộn — mà refresh
       giữa lúc cuộn là nguyên nhân kinh điển gây nhảy vị trí và khoảng trắng.

       Giờ mọi thẻ <img> đều có width/height (hoặc aspect-ratio trong CSS) nên
       chỗ trống đã được giữ sẵn TRƯỚC khi ảnh tải: ảnh tải xong không làm đổi
       layout, không có gì để tính lại.                                       */
  }

  /* ======================================================================
     5 · Đổi chế độ reduced-motion giữa chừng → tải lại cho sạch trạng thái
     ====================================================================== */
  var onReduceChange = function () { window.location.reload(); };
  if (mqReduce.addEventListener) mqReduce.addEventListener('change', onReduceChange);
  else if (mqReduce.addListener) mqReduce.addListener(onReduceChange);

  /* ======================================================================
     6 · API dùng chung
     ====================================================================== */
  window.OPUSK = {
    debug:    false,        // bật true để xem log refresh
    motion:   motion,       // có chạy animation đầy đủ không
    reduced:  reduced,
    hasGSAP:  hasGSAP,
    lenis:    lenis,
    ready:    false,        // animations.js sẽ bật true
    scrollTo: scrollToEl,
    refresh:  refresh,
    refreshSoon: refreshSoon,

    // Cho phép ui.js dừng/chạy lại Lenis khi mở menu mobile
    stopScroll:  function () { if (lenis) lenis.stop(); else body.style.overflow = 'hidden'; },
    startScroll: function () { if (lenis) lenis.start(); else body.style.overflow = ''; },

    // Gỡ khoá hiển thị — animations.js gọi khi đã set xong trạng thái đầu
    markReady: function () {
      window.OPUSK.ready = true;
      clearTimeout(readyGuard);
    },

    // Dọn dẹp (dùng khi nhúng vào SPA sau này)
    destroy: function () {
      clearTimeout(readyGuard);
      clearTimeout(refreshTimer);
      if (lenis) {
        if (hasGSAP) window.gsap.ticker.remove(tick);
        lenis.destroy();
      }
      if (hasGSAP) window.ScrollTrigger.getAll().forEach(function (st) { st.kill(); });
      if (mqReduce.removeEventListener) mqReduce.removeEventListener('change', onReduceChange);
    }
  };
})();
