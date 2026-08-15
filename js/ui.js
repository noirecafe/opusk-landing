/* ==========================================================================
   THE OPUSK — ui.js
   Phase 2 · Tương tác giao diện (không phụ thuộc GSAP)

   1. Menu mobile
   2. Anchor navigation bù chiều cao header
   3. Nav: trong suốt ↔ nền đặc · active state · thu gọn
   4. Sticky action buttons (ẩn / hiện, Top Up, popover)
   5. Hero video — tiết kiệm dữ liệu
   6. Footer — nạp Google Maps khi sắp vào khung nhìn
   7. Năm bản quyền + cảnh báo ảnh thiếu khi chạy local
   ========================================================================== */
(function () {
  'use strict';

  var API = window.OPUSK || {};

  var nav    = document.getElementById('nav');
  var menu   = document.getElementById('menu');
  var burger = document.getElementById('burger');
  var links  = Array.prototype.slice.call(document.querySelectorAll('.nav__link'));

  var qa = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ======================================================================
     1 · MENU MOBILE
     ====================================================================== */
  function closeMenu() {
    if (!menu.classList.contains('is-open')) return;
    menu.classList.remove('is-open');
    nav.classList.remove('is-menu-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    if (API.startScroll) API.startScroll();
    if (API.refreshSoon) API.refreshSoon('menu-close', 320);
  }

  function openMenu() {
    menu.classList.add('is-open');
    nav.classList.add('is-menu-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Close menu');
    if (API.stopScroll) API.stopScroll();
  }

  if (burger) {
    burger.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.classList.contains('is-open') ? closeMenu() : openMenu();
    });
  }

  document.addEventListener('click', function (e) {
    if (menu && !menu.contains(e.target) && burger && !burger.contains(e.target)) closeMenu();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeMenu(); closeAllPops(); closeFab(); }
  });

  /* ======================================================================
     2 · ANCHOR NAVIGATION
     ====================================================================== */
  qa('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id.length < 2) return;

      var target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();
      var wasOpen = menu && menu.classList.contains('is-open');
      closeMenu();

      setTimeout(function () {
        if (API.scrollTo) API.scrollTo(target);
        else target.scrollIntoView({ behavior: 'smooth' });
        history.replaceState(null, '', id);
      }, wasOpen ? 300 : 0);
    });
  });

  window.addEventListener('load', function () {
    if (!location.hash || location.hash.length < 2) return;
    var target = document.querySelector(location.hash);
    if (!target) return;
    setTimeout(function () { if (API.scrollTo) API.scrollTo(target, true); }, 260);
  });

  /* ======================================================================
     3 · NAV — TRONG SUỐT ↔ NỀN ĐẶC
     Dùng sentinel 1px ở đầu <body> thay vì nghe scroll liên tục: rẻ hơn
     nhiều, không đọc layout mỗi khung hình, và hoạt động đúng với Lenis.
     ====================================================================== */
  (function navSurface() {
    if (!nav) return;

    function setSolid(on) { nav.classList.toggle('is-solid', on); }

    if ('IntersectionObserver' in window) {
      var sentinel = document.createElement('div');
      sentinel.setAttribute('aria-hidden', 'true');
      sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:8px;pointer-events:none;';
      document.body.insertBefore(sentinel, document.body.firstChild);

      new IntersectionObserver(function (entries) {
        setSolid(!entries[0].isIntersecting);
      }, { threshold: 0 }).observe(sentinel);

      // Vào trang giữa chừng (reload ở vị trí cũ / mở bằng hash)
      setSolid(window.pageYOffset > 8);
    } else {
      var ticking = false;
      window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          setSolid(window.pageYOffset > 8);
          ticking = false;
        });
      }, { passive: true });
      setSolid(window.pageYOffset > 8);
    }
  })();

  /* --- Active state theo section --- */
  var sections = links
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  function setActive(id) {
    links.forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('href') === '#' + id);
    });
  }

  if ('IntersectionObserver' in window && sections.length) {
    var visible = new Map();
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        visible.set(en.target.id, en.isIntersecting ? en.intersectionRatio : 0);
      });
      var bestId = null, best = 0;
      visible.forEach(function (r, id) { if (r > best) { best = r; bestId = id; } });
      if (bestId) setActive(bestId);
    }, { rootMargin: '-15% 0px -55% 0px', threshold: [0, .15, .3, .5, .75, 1] });

    sections.forEach(function (s) { spy.observe(s); });
  }

  /* --- Header thu gọn sau khi rời hero --- */
  var hero = document.getElementById('home');
  if (hero && nav && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      nav.classList.toggle('is-compact', !entries[0].isIntersecting);
    }, { rootMargin: '-45% 0px 0px 0px', threshold: 0 }).observe(hero);
  }

  /* ======================================================================
     4 · STICKY ACTION BUTTONS
     Mặc định cụm nút ẩn hoàn toàn. Nút toggle bung / thu.
     ====================================================================== */
  var fab       = document.getElementById('fab');
  var fabToggle = document.getElementById('fabToggle');
  var popBtns   = qa('.fab__btn[aria-controls]');

  function closeAllPops(except) {
    popBtns.forEach(function (btn) {
      if (btn === except) return;
      btn.setAttribute('aria-expanded', 'false');
      var pop = document.getElementById(btn.getAttribute('aria-controls'));
      if (pop) pop.hidden = true;
    });
  }

  function closeFab() {
    if (!fab || !fab.classList.contains('is-open')) return;
    fab.classList.remove('is-open');
    if (fabToggle) {
      fabToggle.setAttribute('aria-expanded', 'false');
      fabToggle.setAttribute('aria-label', 'Show quick actions');
    }
    closeAllPops();
  }

  if (fabToggle && fab) {
    fabToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !fab.classList.contains('is-open');
      fab.classList.toggle('is-open', open);
      fabToggle.setAttribute('aria-expanded', String(open));
      fabToggle.setAttribute('aria-label', open ? 'Hide quick actions' : 'Show quick actions');
      if (!open) closeAllPops();
    });
  }

  popBtns.forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var pop  = document.getElementById(btn.getAttribute('aria-controls'));
      var open = pop.hidden;
      closeAllPops(btn);
      pop.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.fab')) { closeAllPops(); closeFab(); }
  });

  /* --- Top Up: về đầu trang --- */
  var btnTop = document.getElementById('btnTop');
  if (btnTop) {
    btnTop.addEventListener('click', function (e) {
      e.stopPropagation();
      if (API.lenis) API.lenis.scrollTo(0, { duration: 1.2 });
      else window.scrollTo({ top: 0, behavior: API.reduced ? 'auto' : 'smooth' });
      closeFab();
    });
  }

  /* ======================================================================
     4b · LOCATION MAP 3D
     Cảnh tự chạy vòng lặp 7.8s đúng như file gốc — KHÔNG gắn vào scroll.
     Hoàn toàn độc lập với GSAP, nên bản đồ vẫn chạy kể cả khi CDN hỏng.
     ====================================================================== */
  (function buildMap() {
    var host = document.getElementById('map3d');
    if (!host || !window.OPUSK_MAP3D) return;

    var small = window.matchMedia('(max-width: 767px)').matches;
    var conn  = navigator.connection || {};
    var thin  = conn.saveData === true || /(^|\D)[23]g/.test(conn.effectiveType || '');

    try {
      window.OPUSK.map3d = window.OPUSK_MAP3D.create(host, {
        quality:  (small || thin) ? 'low' : 'high',
        // Giảm chuyển động → một khung hình tĩnh, đẹp và đọc được
        autoplay: !API.reduced
      });
      if (API.reduced) window.OPUSK.map3d.seek(5.6);
    } catch (err) {
      console.warn('[OpusK] Không dựng được bản đồ 3D:', err);
    }
  })();

  /* ======================================================================
     5 · HERO VIDEO — tiết kiệm dữ liệu
     ====================================================================== */
  var video = document.getElementById('heroVideo');

  if (video) {
    var conn  = navigator.connection || {};
    var slow  = conn.saveData === true || /2g/.test(conn.effectiveType || '');
    var small = window.matchMedia('(max-width: 767px)').matches;

    if (API.reduced || slow || small) {
      video.removeAttribute('autoplay');
      video.pause();
      while (video.firstChild) video.removeChild(video.firstChild);
      video.load();
    } else {
      var p = video.play();
      if (p && p.catch) p.catch(function () { /* autoplay bị chặn — poster vẫn hiện */ });

      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          entries[0].isIntersecting ? video.play().catch(function () {}) : video.pause();
        }, { threshold: 0.05 }).observe(video);
      }
    }
  }

  /* ======================================================================
     6 · FOOTER — bản đồ hiện luôn, iframe nạp khi sắp vào khung nhìn
     Không nạp ngay lúc tải trang: iframe Google Maps kéo theo vài trăm KB
     và cookie bên thứ ba. Nạp trước 400px là đủ để người dùng không thấy chờ.
     ====================================================================== */
  var mapBox = document.getElementById('footerMap');

  if (mapBox && mapBox.dataset.src) {
    var mount = function () {
      if (mapBox.dataset.mounted) return;
      mapBox.dataset.mounted = '1';

      var iframe = document.createElement('iframe');
      iframe.src = mapBox.dataset.src;
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      iframe.title = 'Bản đồ vị trí The OpusK — The Metropole Thu Thiem';
      iframe.allowFullscreen = true;
      iframe.addEventListener('load', function () {
        var sk = mapBox.querySelector('.footer__map-skeleton');
        if (sk) sk.remove();
        if (API.refreshSoon) API.refreshSoon('map-embed', 400);
      }, { once: true });

      mapBox.appendChild(iframe);
    };

    if ('IntersectionObserver' in window) {
      var mapSpy = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        mapSpy.disconnect();
        mount();
      }, { rootMargin: '400px 0px' });
      mapSpy.observe(mapBox);
    } else {
      window.addEventListener('load', mount);
    }
  }

  /* ======================================================================
     7 · Năm bản quyền + cảnh báo ảnh thiếu khi chạy local
     ====================================================================== */
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  if (location.protocol === 'file:' || /^(localhost|127\.)/.test(location.hostname)) {
    qa('img').forEach(function (img) {
      img.addEventListener('error', function () {
        img.style.cssText +=
          ';min-height:120px;background:repeating-linear-gradient(45deg,#f2ede6,#f2ede6 10px,#e6ddd1 10px,#e6ddd1 20px);' +
          'outline:1px dashed #b9a58a;';
        console.warn('[OpusK] Thiếu ảnh:', img.getAttribute('src'));
      });
    });
  }
})();
