/*
 * The shopping cart, moved off WordPress.
 *
 * WooCommerce kept the cart in a PHP session and rendered /cart/ and /checkout/
 * from the Store API. Neither exists on a static host, so the cart lives in
 * localStorage and the panels are re-rendered from the markup captured off the
 * live site (assets/cart-templates.json). What a visitor sees and can do is
 * unchanged: add to cart from a product page or a product grid, change
 * quantities, remove lines, open the coupon panel, proceed to checkout, and
 * meet the same "There are no payment methods available" state the live store
 * shows -- this store has no payment gateway enabled.
 */
(function () {
  'use strict';

  var KEY = 'fbj_cart';
  var money = function (n) { return '$' + n.toFixed(2); };

  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(v) ? v.filter(function (i) { return i && i.id && i.qty > 0; }) : [];
    } catch (e) { return []; }
  }
  function write(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {}
  }
  function add(id, qty) {
    var items = read();
    var hit = items.filter(function (i) { return i.id === id; })[0];
    if (hit) hit.qty += qty; else items.push({ id: id, qty: qty });
    write(items);
  }

  var catalogue = null, templates = null;
  // the build stamp this script was served with, so its data files are read
  // from the same generation rather than a cached older one
  var VERSION = (document.currentScript ||
    document.querySelector('script[src^="/assets/cart.js"]') || {}).dataset?.v || '';
  function load(url) {
    return fetch(url + (VERSION ? '?v=' + VERSION : ''), { credentials: 'same-origin' })
      .then(function (r) { return r.json(); });
  }
  function product(id) {
    for (var i = 0; i < catalogue.length; i++) if (catalogue[i].id === id) return catalogue[i];
    return null;
  }
  function lines() {
    return read().map(function (i) {
      var p = product(i.id);
      return p ? { p: p, qty: i.qty, total: parseFloat(p.price || '0') * i.qty } : null;
    }).filter(Boolean);
  }
  function total() {
    return lines().reduce(function (s, l) { return s + l.total; }, 0);
  }

  // ------------------------------------------------------------- add to cart
  function idFromHref(href) {
    var m = /[?&]add-to-cart=(\d+)/.exec(href || '');
    return m ? parseInt(m[1], 10) : 0;
  }

  // Product grids used WooCommerce's AJAX add-to-cart: the button gains an
  // `added` class and a "View cart" link is appended after it.
  function bindLoopButtons() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href*="add-to-cart="]');
      if (!a) return;
      var id = idFromHref(a.getAttribute('href'));
      if (!id) return;
      e.preventDefault();
      add(id, parseInt(a.getAttribute('data-quantity') || '1', 10) || 1);
      if (a.classList.contains('ajax_add_to_cart') || a.classList.contains('add_to_cart_button')) {
        a.classList.add('added');
        if (!a.nextElementSibling || !a.nextElementSibling.classList.contains('added_to_cart')) {
          var view = document.createElement('a');
          view.href = '/cart/';
          view.className = 'added_to_cart wc-forward';
          view.title = 'View cart';
          view.textContent = 'View cart';
          a.parentNode.insertBefore(view, a.nextSibling);
        }
        return;
      }
      // the product page's Add To Cart button carries WordPress's own
      // e-redirect target; follow it exactly as the live site does
      var redirect = /[?&]e-redirect=([^&]+)/.exec(a.getAttribute('href'));
      location.href = redirect ? decodeURIComponent(redirect[1]) : location.pathname;
    });
  }

  // A visitor can also arrive on a URL that already carries ?add-to-cart=
  function consumeQuery() {
    var id = idFromHref(location.search);
    if (!id) return;
    var q = /[?&]quantity=(\d+)/.exec(location.search);
    add(id, q ? parseInt(q[1], 10) : 1);
    var url = new URL(location.href);
    url.searchParams.delete('add-to-cart');
    url.searchParams.delete('quantity');
    url.searchParams.delete('e-redirect');
    history.replaceState(null, '', url.pathname + (url.search === '?' ? '' : url.search));
  }

  // ------------------------------------------------------------------- cart
  function rowTemplate() {
    var wrap = document.createElement('div');
    wrap.innerHTML = templates.filled;
    return wrap.querySelector('tr.wc-block-cart-items__row');
  }

  function renderCart(host) {
    var ls = lines();
    if (!ls.length) {
      host.outerHTML = templates.empty;
      return;
    }
    var wrap = document.createElement('div');
    wrap.innerHTML = templates.filled;
    var panel = wrap.firstElementChild;
    var tpl = panel.querySelector('tr.wc-block-cart-items__row');
    var tbody = tpl.parentNode;
    tbody.innerHTML = '';
    ls.forEach(function (l) {
      var row = tpl.cloneNode(true);
      fillCartRow(row, l);
      tbody.appendChild(row);
    });
    setText(panel, '.wc-block-components-totals-footer-item .wc-block-components-formatted-money-amount',
            money(total()));
    host.parentNode.replaceChild(panel, host);
    bindCart(panel);
  }

  function setText(root, sel, text) {
    var el = root.querySelector(sel);
    if (el) el.textContent = text;
  }

  function fillCartRow(row, l) {
    var p = l.p;
    row.setAttribute('data-cart-item-key', 'fbj-' + p.id);
    var img = row.querySelector('.wc-block-cart-item__image img');
    if (img) { img.src = p.imgSrc; img.srcset = p.imgSrcset; img.alt = p.imgAlt; }
    var imgLink = row.querySelector('.wc-block-cart-item__image a');
    if (imgLink) imgLink.href = p.url;
    var head = row.querySelector('.wc-block-cart-item__product');
    if (head) head.setAttribute('aria-label', p.name);
    var name = row.querySelector('a.wc-block-components-product-name');
    if (name) { name.href = p.url; name.textContent = p.name; }
    setText(row, '.wc-block-cart-item__prices .wc-block-components-product-price__value',
            money(parseFloat(p.price || '0')));
    var desc = row.querySelector('.wc-block-components-product-metadata__description');
    if (desc) desc.innerHTML = '<p>' + escapeHtml(p.excerpt) + '</p>\n';
    var input = row.querySelector('.wc-block-components-quantity-selector__input');
    if (input) {
      input.value = String(l.qty);
      input.setAttribute('aria-label', 'Quantity of ' + p.name + ' in your cart.');
    }
    var minus = row.querySelector('.wc-block-components-quantity-selector__button--minus');
    if (minus) { minus.setAttribute('aria-label', 'Reduce quantity of ' + p.name); minus.disabled = l.qty <= 1; }
    var plus = row.querySelector('.wc-block-components-quantity-selector__button--plus');
    if (plus) plus.setAttribute('aria-label', 'Increase quantity of ' + p.name);
    var rm = row.querySelector('.wc-block-cart-item__remove-link');
    if (rm) rm.setAttribute('aria-label', 'Remove ' + p.name + ' from cart');
    setText(row, '.wc-block-cart-item__total .wc-block-components-product-price__value', money(l.total));
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function setQty(id, qty) {
    var items = read();
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) {
        if (qty <= 0) items.splice(i, 1); else items[i].qty = qty;
        break;
      }
    }
    write(items);
  }

  function bindCart(panel) {
    panel.addEventListener('click', function (e) {
      var row = e.target.closest && e.target.closest('tr.wc-block-cart-items__row');
      if (row) {
        // the row carries no extra attribute of ours: the product is read back
        // off its own link, exactly as it appears in the live markup
        var id = productIdFromRow(row);
        if (e.target.closest('.wc-block-components-quantity-selector__button--plus')) {
          setQty(id, currentQty(id) + 1); return reRender();
        }
        if (e.target.closest('.wc-block-components-quantity-selector__button--minus')) {
          setQty(id, currentQty(id) - 1); return reRender();
        }
        if (e.target.closest('.wc-block-cart-item__remove-link')) {
          setQty(id, 0); return reRender();
        }
      }
      var coupon = e.target.closest && e.target.closest('.wc-block-components-panel__button');
      if (coupon) togglePanel(coupon);
    });
    panel.addEventListener('change', function (e) {
      var input = e.target.closest && e.target.closest('.wc-block-components-quantity-selector__input');
      if (!input) return;
      var row = input.closest('tr.wc-block-cart-items__row');
      setQty(productIdFromRow(row), Math.max(0, parseInt(input.value, 10) || 0));
      reRender();
    });
  }

  function productIdFromRow(row) {
    var a = row.querySelector('a.wc-block-components-product-name');
    var slug = a ? (a.getAttribute('href') || '').replace(/\/$/, '').split('/').pop() : '';
    for (var i = 0; i < catalogue.length; i++) if (catalogue[i].slug === slug) return catalogue[i].id;
    return 0;
  }

  function currentQty(id) {
    var hit = read().filter(function (i) { return i.id === id; })[0];
    return hit ? hit.qty : 0;
  }

  function reRender() {
    var host = document.querySelector('.wp-block-woocommerce-cart');
    if (host) renderCart(host);
  }

  // The coupon panel is the one piece of Blocks interactivity the cart keeps.
  function togglePanel(button) {
    var open = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', open ? 'false' : 'true');
    var panel = button.parentNode;
    panel.classList.toggle('is-open', !open);
    var body = panel.querySelector('.wc-block-components-panel__content');
    if (!open && !body) {
      body = document.createElement('div');
      body.className = 'wc-block-components-panel__content';
      body.innerHTML =
        '<div class="wc-block-components-totals-coupon__content">' +
        '<form class="wc-block-components-totals-coupon__form" id="wc-block-components-totals-coupon__form">' +
        '<div class="wc-block-components-text-input wc-block-components-totals-coupon__input">' +
        '<input type="text" id="wc-block-components-totals-coupon__input-coupon" value="" aria-label="Enter code">' +
        '<label for="wc-block-components-totals-coupon__input-coupon">Enter code</label></div>' +
        '<button class="wc-block-components-button wp-element-button wc-block-components-totals-coupon__button contained" type="submit">' +
        '<div class="wc-block-components-button__text">Apply</div></button></form></div>';
      panel.appendChild(body);
      body.querySelector('form').addEventListener('submit', function (ev) {
        ev.preventDefault();
        showCouponError(body);
      });
    } else if (body) {
      body.hidden = open;
    }
  }

  function showCouponError(body) {
    var input = body.querySelector('input');
    var code = (input.value || '').trim();
    var old = body.querySelector('.wc-block-components-validation-error');
    if (old) old.remove();
    var err = document.createElement('div');
    err.className = 'wc-block-components-validation-error';
    err.setAttribute('role', 'alert');
    err.innerHTML = '<p>' + (code
      ? '"' + escapeHtml(code) + '" is not a valid coupon code.'
      : 'Please enter a coupon code.') + '</p>';
    body.querySelector('.wc-block-components-totals-coupon__input').appendChild(err);
  }

  // --------------------------------------------------------------- checkout
  function renderCheckout(host) {
    var ls = lines();
    if (!ls.length) { location.replace('/cart/'); return; }
    var wrap = document.createElement('div');
    wrap.innerHTML = templates.checkout;
    var panel = wrap.firstElementChild;
    var listHost = panel.querySelector('.wc-block-components-order-summary__content');
    var tpl = listHost.querySelector('.wc-block-components-order-summary-item');
    listHost.innerHTML = '';
    ls.forEach(function (l) {
      var item = tpl.cloneNode(true);
      fillSummaryItem(item, l);
      listHost.appendChild(item);
    });
    var t = money(total());
    setText(panel, '.wc-block-components-checkout-order-summary__title-price', t);
    setText(panel, '.wp-block-woocommerce-checkout-order-summary-subtotal-block .wc-block-components-totals-item__value', t);
    setText(panel, '.wc-block-components-totals-footer-item .wc-block-components-formatted-money-amount', t);
    host.parentNode.replaceChild(panel, host);
    bindCheckout(panel);
  }

  function fillSummaryItem(item, l) {
    var p = l.p;
    var qty = item.querySelector('.wc-block-components-order-summary-item__quantity');
    if (qty) qty.innerHTML = '<span aria-hidden="true">' + l.qty + '</span>' +
      '<span class="screen-reader-text">' + l.qty + ' item' + (l.qty === 1 ? '' : 's') + '</span>';
    var img = item.querySelector('img');
    if (img) { img.src = p.imgSrc; img.srcset = p.imgSrcset; img.alt = p.imgAlt; }
    setText(item, 'h3.wc-block-components-product-name', p.name);
    setText(item, '.wc-block-components-order-summary-item__individual-price', money(parseFloat(p.price || '0')));
    var desc = item.querySelector('.wc-block-components-product-metadata__description');
    if (desc) desc.innerHTML = '<p>' + escapeHtml(p.excerpt) + '</p>\n';
    var sr = item.querySelector(':scope > .screen-reader-text');
    if (sr) sr.textContent = 'Total price for ' + l.qty + ' ' + p.name + ' item' +
      (l.qty === 1 ? '' : 's') + ': ' + money(l.total);
    setText(item, '.wc-block-components-order-summary-item__total-price .wc-block-components-product-price__value',
            money(l.total));
  }

  function bindCheckout(panel) {
    panel.addEventListener('click', function (e) {
      var coupon = e.target.closest && e.target.closest('.wc-block-components-panel__button');
      if (coupon) return togglePanel(coupon);
      var place = e.target.closest && e.target.closest('.wc-block-components-checkout-place-order-button');
      if (place) {
        // no payment gateway is enabled on this store, exactly as on the live
        // site: the order cannot be submitted
        e.preventDefault();
        var notices = panel.querySelector('.wc-block-components-notices');
        if (notices) {
          notices.innerHTML =
            '<div class="wc-block-components-notice-banner is-error" role="alert">' +
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">' +
            '<path d="M12 3.2c-4.8 0-8.8 3.9-8.8 8.8 0 4.8 3.9 8.8 8.8 8.8 4.8 0 8.8-3.9 8.8-8.8 0-4.8-4-8.8-8.8-8.8zm0 16c-4 0-7.2-3.3-7.2-7.2C4.8 8 8 4.8 12 4.8s7.2 3.3 7.2 7.2c0 4-3.2 7.2-7.2 7.2zM11 17h2v-2h-2v2zm0-4h2V7h-2v6z"></path></svg>' +
            '<div class="wc-block-components-notice-banner__content">' +
            'There are no payment methods available. Please contact us for help placing your order.' +
            '</div></div>';
          notices.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });
  }

  // ------------------------------------------------------------------- boot
  function boot() {
    consumeQuery();
    bindLoopButtons();
    var cartHost = document.querySelector('.wp-block-woocommerce-cart');
    var checkoutHost = document.querySelector('.wp-block-woocommerce-checkout');
    if (!cartHost && !checkoutHost) return;
    Promise.all([load('/assets/catalogue.json'), load('/assets/cart-templates.json')])
      .then(function (r) {
        catalogue = r[0];
        templates = r[1];
        if (cartHost) renderCart(cartHost);
        else if (checkoutHost) renderCheckout(checkoutHost);
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
