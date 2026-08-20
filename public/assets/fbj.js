/*
 * Behaviour that used to come from a WordPress backend, reproduced for the
 * static build. Everything the vendor bundles still handle (sticky header,
 * entrance animations, product gallery slider, zoom, lightbox, the FAQ
 * accordion in the product tabs) runs from the original scripts, unchanged.
 *
 * Covered here:
 *   1. the Elementor "Instant Quote" form on product pages
 *   2. shop / category / brand archive sorting (?orderby=)
 *   3. the product search results page (/?s=)
 *   4. the My account forms, which have no accounts left to authenticate
 */
(function () {
  'use strict';

  // ----------------------------------------------------- 1. Elementor form
  function elementorMessage(form, cls, text) {
    var wrap = form.querySelector('.elementor-message-group');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'elementor-message-group';
      form.appendChild(wrap);
    }
    wrap.innerHTML = '<div class="elementor-message ' + cls + '" role="alert">' + text + '</div>';
  }

  Array.prototype.forEach.call(document.querySelectorAll('form.elementor-form'), function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      // Elementor's own required-field handling, kept verbatim in wording
      var invalid = form.querySelector(':invalid');
      if (invalid) {
        elementorMessage(form, 'elementor-message-danger', 'This field is required.');
        invalid.focus();
        return;
      }
      var button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      var fd = new FormData(form);
      fd.append('page_url', form.getAttribute('data-page-url') || window.location.href);
      fetch('/api/quote/', { method: 'POST', body: fd })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (d) {
          if (d && d.success) {
            elementorMessage(form, 'elementor-message-success', 'The form was sent successfully.');
            form.reset();
          } else {
            elementorMessage(form, 'elementor-message-danger',
              (d && d.message) || 'An error occurred.');
          }
        })
        .catch(function () {
          elementorMessage(form, 'elementor-message-danger',
            'Your submission failed because of a server error.');
        })
        .then(function () { if (button) button.disabled = false; });
    });
  });

  // ------------------------------------------------- 2 + 3. archive listing
  var params = new URLSearchParams(location.search);
  var orderby = params.get('orderby');
  var search = params.get('s');
  var grid = document.querySelector('ul.products');
  var isArchive = !!document.querySelector('.storefront-sorting');

  function sortKey(name) {
    return {
      popularity: function (a, b) { return b.sales - a.sales || a.name.localeCompare(b.name); },
      date: function (a, b) { return b.date.localeCompare(a.date); },
      price: function (a, b) { return a.price - b.price || a.name.localeCompare(b.name); },
      'price-desc': function (a, b) { return b.price - a.price || a.name.localeCompare(b.name); },
      menu_order: function (a, b) { return a.name.localeCompare(b.name); },
    }[name] || null;
  }

  // which products this archive lists, taken from the page it was built for
  function scopeFilter() {
    var p = location.pathname;
    var m = /^\/product-category\/([^/]+)\//.exec(p);
    if (m) return function (x) { return x.cats.indexOf(m[1]) >= 0; };
    return function () { return true; };
  }

  function renderGrid(items, perPage, page, countText) {
    var start = (page - 1) * perPage;
    var slice = items.slice(start, start + perPage);
    grid.innerHTML = slice.map(function (x, i) {
      var li = x.loop;
      // WooCommerce marks the first and last tile of each row group
      li = li.replace(/ (first|last)(?=[ "])/g, '');
      if (i % 4 === 0) li = li.replace('class="product ', 'class="product first ');
      return li;
    }).join('\n');
    // the archive prints the result count twice, above and below the grid
    Array.prototype.forEach.call(document.querySelectorAll('.woocommerce-result-count'), function (el) {
      el.textContent = countText;
    });
  }

  function resultText(total, perPage, page) {
    if (total <= perPage) {
      return total === 1 ? 'Showing the single result' : 'Showing all ' + total + ' results';
    }
    var from = (page - 1) * perPage + 1;
    var to = Math.min(total, page * perPage);
    return 'Showing ' + from + '–' + to + ' of ' + total + ' results';
  }

  function withLoops(fn) {
    fetch('/assets/loops.json').then(function (r) { return r.json(); }).then(fn);
  }

  if (grid && isArchive && (orderby || search)) {
    var select = document.querySelector('select.orderby');
    if (select && orderby) select.value = orderby;
    withLoops(function (all) {
      var items = all.filter(scopeFilter());
      if (search) {
        var q = search.toLowerCase();
        items = all.filter(function (x) {
          return x.name.toLowerCase().indexOf(q) >= 0 || x.text.indexOf(q) >= 0;
        }).sort(function (a, b) {
          var an = a.name.toLowerCase().indexOf(q) >= 0 ? 0 : 1;
          var bn = b.name.toLowerCase().indexOf(q) >= 0 ? 0 : 1;
          return an - bn || a.name.localeCompare(b.name);
        });
      }
      var cmp = sortKey(orderby);
      if (cmp) items = items.slice().sort(cmp);
      else if (!search) items = items.slice().sort(sortKey('menu_order'));
      var page = parseInt(params.get('paged') || '1', 10) || 1;
      renderGrid(items, 16, page, resultText(items.length, 16, page));
    });
  }

  // the sorting <select> submitted a GET form under WordPress; keep that
  Array.prototype.forEach.call(document.querySelectorAll('form.woocommerce-ordering'), function (form) {
    form.addEventListener('submit', function (e) { e.preventDefault(); go(form); });
    var sel = form.querySelector('select.orderby');
    if (sel) sel.addEventListener('change', function () { go(form); });
    function go(f) {
      var q = new URLSearchParams(location.search);
      q.set('orderby', f.querySelector('select.orderby').value);
      q.delete('paged');
      location.search = q.toString();
    }
  });

  // the search page's heading and the sorting form's hidden term
  if (search) {
    var title = document.querySelector('.woocommerce-products-header__title');
    if (title) title.innerHTML = 'Search results: &ldquo;' + escapeHtml(search) + '&rdquo;';
    document.title = 'You searched for ' + search + ' - Florida Basktetball Jerseys';
    Array.prototype.forEach.call(document.querySelectorAll('input[name="s"]'), function (i) {
      i.value = search;
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // the 404 page's product search box posted to /?s=<term>&post_type=product
  Array.prototype.forEach.call(document.querySelectorAll('form.woocommerce-product-search'), function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var term = form.querySelector('input[name="s"]').value || '';
      location.href = '/?s=' + encodeURIComponent(term) + '&post_type=product';
    });
  });

  // ------------------------------------------------------- 4. My account
  // The store has no customer accounts: registration was disabled and no order
  // was ever placed. The forms keep their markup and WooCommerce's own wording.
  function accountError(form, html) {
    var wrap = form.closest('.woocommerce') || form.parentNode;
    var old = wrap.querySelector('.woocommerce-error');
    if (old) old.remove();
    var ul = document.createElement('ul');
    ul.className = 'woocommerce-error';
    ul.setAttribute('role', 'alert');
    ul.innerHTML = '<li>' + html + '</li>';
    wrap.insertBefore(ul, wrap.firstChild);
    ul.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // WooCommerce's own show/hide-password control, which its frontend bundle
  // injected into every password field
  Array.prototype.forEach.call(
    document.querySelectorAll('.woocommerce form input[type="password"]'), function (input) {
      if (input.parentNode.classList.contains('password-input')) return;
      var span = document.createElement('span');
      span.className = 'password-input';
      input.parentNode.insertBefore(span, input);
      span.appendChild(input);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'show-password-input';
      btn.setAttribute('aria-label', 'Show password');
      btn.setAttribute('aria-describedBy', input.id);
      span.appendChild(btn);
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var shown = btn.classList.toggle('display-password');
        btn.setAttribute('aria-label', shown ? 'Hide password' : 'Show password');
        input.type = shown ? 'text' : 'password';
      });
    });

  var login = document.querySelector('form.woocommerce-form-login');
  if (login) {
    login.addEventListener('submit', function (e) {
      e.preventDefault();
      var user = (login.querySelector('#username') || {}).value || '';
      accountError(login, '<strong>Error:</strong> The username <strong>' +
        escapeHtml(user) + '</strong> is not registered on this site. If you are unsure of your ' +
        'username, try your email address instead.');
    });
  }
  var lost = document.querySelector('form.woocommerce-ResetPassword');
  if (lost) {
    lost.addEventListener('submit', function (e) {
      e.preventDefault();
      accountError(lost, '<strong>Error:</strong> There is no account with that username or email address.');
    });
  }
})();
