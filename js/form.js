/* ==========================================================================
   THE OPUSK — form.js
   Trang liên hệ: menu mobile, kiểm tra dữ liệu, gửi biểu mẫu.

   Không phụ thuộc GSAP / Lenis — trang này chỉ cần chạy đúng và nhanh.
   ========================================================================== */
(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ======================================================================
     1 · MENU MOBILE
     ====================================================================== */
  var menu   = $('#menu');
  var burger = $('#burger');

  if (burger && menu) {
    burger.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !menu.classList.contains('is-open');
      menu.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
    });
    document.addEventListener('click', function (e) {
      if (!menu.contains(e.target) && !burger.contains(e.target)) {
        menu.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  var y = $('#year');
  if (y) y.textContent = new Date().getFullYear();

  /* ======================================================================
     2 · KIỂM TRA DỮ LIỆU
     Thông báo lỗi bằng tiếng Việt, hiện ngay dưới ô nhập. Chỉ kiểm lại khi
     người dùng rời ô (blur) hoặc bấm gửi — không càu nhàu ngay lúc đang gõ.
     ====================================================================== */
  var form  = $('#leadForm');
  if (!form) return;

  var alertBox = $('#formAlert');
  var doneBox  = $('#formDone');
  var submit   = $('.form__submit', form);

  var RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  // Số VN: cho phép +84 / 0, khoảng trắng, chấm, gạch ngang, ngoặc
  var RE_PHONE = /^[+()\d][\d\s.\-()]{7,19}$/;

  var RULES = {
    name: function (v) {
      if (!v) return 'Vui lòng nhập họ và tên.';
      if (v.length < 2) return 'Họ và tên trông chưa đúng.';
      return '';
    },
    phone: function (v) {
      if (!v) return 'Vui lòng nhập số điện thoại.';
      if (!RE_PHONE.test(v)) return 'Số điện thoại chưa hợp lệ.';
      return '';
    },
    email: function (v) {
      if (!v) return 'Vui lòng nhập email.';
      if (!RE_EMAIL.test(v)) return 'Email chưa hợp lệ.';
      return '';
    },
    company: function () { return ''; },
    message: function () { return ''; }
  };

  function fieldOf(input) { return input.closest('.form__field'); }

  function setError(input, msg) {
    var wrap = fieldOf(input);
    if (!wrap) return;
    var slot = $('[data-err]', wrap);
    wrap.classList.toggle('is-invalid', !!msg);
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (slot) slot.textContent = msg || '';
  }

  function validate(input) {
    var rule = RULES[input.name];
    if (!rule) return true;
    var msg = rule(input.value.trim());
    setError(input, msg);
    return !msg;
  }

  var inputs = $$('input[name], textarea[name]', form)
    .filter(function (i) { return i.name !== 'website'; });

  inputs.forEach(function (input) {
    input.addEventListener('blur', function () { validate(input); });
    input.addEventListener('input', function () {
      // Đang sửa một ô đã báo lỗi → xoá lỗi ngay khi giá trị hợp lệ trở lại
      if (fieldOf(input) && fieldOf(input).classList.contains('is-invalid')) validate(input);
    });
  });

  /* ======================================================================
     3 · GỬI
     ====================================================================== */
  function say(msg, kind) {
    if (!alertBox) return;
    alertBox.textContent = msg;
    alertBox.className = 'form__alert is-' + (kind || 'error');
    alertBox.hidden = !msg;
  }

  var sending = false;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;

    say('');

    var firstBad = null;
    inputs.forEach(function (input) {
      if (!validate(input) && !firstBad) firstBad = input;
    });
    if (firstBad) {
      firstBad.focus();
      say('Vui lòng kiểm tra lại các ô được đánh dấu.', 'error');
      return;
    }

    var payload = {};
    inputs.forEach(function (i) { payload[i.name] = i.value.trim(); });
    payload.website = ($('#website') || {}).value || '';   // bẫy spam
    payload.page = location.pathname;

    sending = true;
    form.classList.add('is-sending');
    submit.disabled = true;

    fetch(form.getAttribute('action'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; })
          .then(function (data) { return { status: res.status, data: data }; });
      })
      .then(function (r) {
        if (r.status === 201 || (r.data && r.data.ok)) {
          form.hidden = true;
          if (doneBox) {
            doneBox.hidden = false;
            doneBox.setAttribute('tabindex', '-1');
            doneBox.focus();
            doneBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }

        /* Chưa cấu hình database → không để người dùng bơ vơ, chỉ luôn
           kênh liên hệ trực tiếp. */
        if (r.status === 503) {
          say('Hệ thống tiếp nhận đang được cấu hình. Vui lòng gọi ' +
              '+(84) 902 430 179 hoặc gửi email tới Lm1@highgate.vn — ' +
              'chúng tôi sẽ hỗ trợ ngay.', 'warn');
          return;
        }
        if (r.status === 429) {
          say('Bạn vừa gửi một yêu cầu. Vui lòng chờ ít phút trước khi gửi tiếp.', 'warn');
          return;
        }
        if (r.status === 422 && r.data && r.data.fields) {
          Object.keys(r.data.fields).forEach(function (k) {
            var input = form.querySelector('[name="' + k + '"]');
            if (input) setError(input, r.data.fields[k]);
          });
          say('Vui lòng kiểm tra lại các ô được đánh dấu.', 'error');
          return;
        }
        say('Không gửi được yêu cầu. Vui lòng thử lại, hoặc gọi ' +
            '+(84) 902 430 179.', 'error');
      })
      .catch(function () {
        say('Mất kết nối tới máy chủ. Kiểm tra đường truyền rồi thử lại, ' +
            'hoặc gọi +(84) 902 430 179.', 'error');
      })
      .then(function () {
        sending = false;
        form.classList.remove('is-sending');
        submit.disabled = false;
      });
  });
})();
