/* Knowledge Garden · core runtime (theme, navigation, search, favorites, local lists) */
(function () {
  'use strict';

  var KG = window.KG = window.KG || {};
  var doc = document;
  var root = doc.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  KG.reduceMotion = reduceMotion;

  /* ------------------------------------------------------------------ utils */
  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function emit(name, detail) { doc.dispatchEvent(new CustomEvent(name, { detail: detail })); }

  // Canonical storage key for a document URL: decoded pathname with trailing slash.
  function key(url) {
    var p;
    try { p = new URL(url, location.href).pathname; } catch (e) { p = String(url || ''); }
    try { p = decodeURI(p); } catch (e) {}
    if (!/\.[a-z0-9]+$/i.test(p) && p.slice(-1) !== '/') p += '/';
    return p;
  }

  var store = {
    get: function (k, fallback) {
      try {
        var v = localStorage.getItem('kg:' + k);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set: function (k, v) {
      try { localStorage.setItem('kg:' + k, JSON.stringify(v)); return true; } catch (e) { return false; }
    }
  };

  function toast(msg) {
    var old = $('.kg-toast');
    if (old) old.remove();
    var el = doc.createElement('div');
    el.className = 'kg-toast';
    el.setAttribute('role', 'status');
    el.textContent = msg;
    doc.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2300);
  }

  function timeAgo(ts) {
    var s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return '刚刚';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
    if (s < 86400 * 30) return Math.floor(s / 86400) + ' 天前';
    var d = new Date(ts);
    return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate();
  }

  KG.$ = $; KG.$$ = $$; KG.esc = esc; KG.key = key; KG.store = store; KG.toast = toast; KG.emit = emit;

  /* ------------------------------------------------------------------ theme */
  function applyTheme(t, persist) {
    t = t === 'dark' ? 'dark' : 'light';
    root.setAttribute('data-theme', t);
    if (persist) { try { localStorage.setItem('kg:theme', t); } catch (e) {} }
    $$('[data-kg-theme-toggle]').forEach(function (b) { b.setAttribute('aria-pressed', String(t === 'dark')); });
    var meta = $('[data-kg-theme-color]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0D1219' : '#F2F5F9');
    emit('kg:theme', { theme: t });
  }
  KG.theme = function () { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; };

  function initTheme() {
    applyTheme(KG.theme(), false);
    doc.addEventListener('click', function (e) {
      var b = e.target.closest('[data-kg-theme-toggle]');
      if (!b) return;
      applyTheme(KG.theme() === 'dark' ? 'light' : 'dark', true);
    });
    window.addEventListener('storage', function (e) {
      if (e.key === 'kg:theme' && e.newValue) applyTheme(e.newValue, false);
      if (e.key === 'kg:favs' || e.key === 'kg:recent' || e.key === 'kg:progress') refreshLocal();
    });
  }

  /* ------------------------------------------------------------- navigation */
  function initNav() {
    var nav = $('[data-kg-nav]');
    if (!nav) return;
    var toggle = $('[data-kg-menu-toggle]', nav);
    function setOpen(open) {
      nav.classList.toggle('is-open', open);
      if (toggle) toggle.setAttribute('aria-expanded', String(open));
    }
    if (toggle) toggle.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!nav.classList.contains('is-open')); });
    doc.addEventListener('click', function (e) { if (!e.target.closest('[data-kg-menu]')) setOpen(false); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });

    // Auto-hide while reading downwards, reveal on any upward scroll.
    var lastY = window.pageYOffset, ticking = false;
    var totop = $('[data-kg-totop]');
    function onScroll() {
      var y = window.pageYOffset;
      var down = y > lastY + 6, up = y < lastY - 6;
      if (y < 240 || up) nav.classList.remove('is-hidden');
      else if (down && !nav.classList.contains('is-open') && doc.body.classList.contains('kg-autohide')) nav.classList.add('is-hidden');
      if (down || up) lastY = y;
      if (totop) totop.hidden = y < 900;
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    if (totop) totop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* -------------------------------------------------- hover light + reveal */
  function initSurface() {
    if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
      doc.addEventListener('pointermove', function (e) {
        var el = e.target.closest && e.target.closest('.kg-float');
        if (!el) return;
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }, { passive: true });
    }
    var items = $$('[data-kg-reveal]');
    if (!items.length) return;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* -------------------------------------------- favorites / recent / progress */
  var favs = {
    all: function () { return store.get('favs', []); },
    has: function (u) { u = key(u); return favs.all().some(function (f) { return f.u === u; }); },
    toggle: function (u, title, module) {
      u = key(u);
      var list = favs.all();
      var i = -1;
      list.forEach(function (f, idx) { if (f.u === u) i = idx; });
      var added = i < 0;
      if (added) list.unshift({ u: u, t: title || u, m: module || '', ts: Date.now() });
      else list.splice(i, 1);
      if (!store.set('favs', list)) { toast('浏览器禁用了本地存储，无法收藏'); return false; }
      toast(added ? '已收藏《' + (title || '') + '》' : '已取消收藏');
      refreshLocal();
      return added;
    }
  };
  var recent = {
    all: function () { return store.get('recent', []); },
    push: function (u, title, module) {
      u = key(u);
      var list = recent.all().filter(function (r) { return r.u !== u; });
      list.unshift({ u: u, t: title, m: module || '', ts: Date.now() });
      store.set('recent', list.slice(0, 40));
    }
  };
  var progress = {
    all: function () { return store.get('progress', {}); },
    get: function (u) { return progress.all()[key(u)] || 0; },
    set: function (u, pct) {
      var all = progress.all();
      u = key(u);
      pct = Math.max(0, Math.min(100, Math.round(pct)));
      if (all[u] === pct) return;
      all[u] = pct;
      store.set('progress', all);
    }
  };
  KG.favs = favs; KG.recent = recent; KG.progress = progress;

  function localItem(it, pct, withFav) {
    var meta = [];
    if (it.m) meta.push('<span>' + esc(it.m) + '</span>');
    if (it.ts) meta.push('<span>' + timeAgo(it.ts) + '</span>');
    if (pct > 0) meta.push('<span class="kg-local__bar" style="--p:' + pct + '%"><i></i></span><span class="kg-num">' + (pct >= 97 ? '已读完' : pct + '%') + '</span>');
    return '<li class="kg-local__item"><a href="' + esc(encodeURI(it.u)) + '">' +
      '<span class="kg-local__title">' + esc(it.t) + '</span>' +
      '<span class="kg-local__meta">' + meta.join('') + '</span></a>' +
      (withFav ? '<button class="kg-fav" type="button" data-kg-fav="' + esc(it.u) + '" data-title="' + esc(it.t) + '" data-module="' + esc(it.m) + '" aria-pressed="true" aria-label="取消收藏">' +
        '<svg class="kg-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 4h11a.5.5 0 0 1 .5.5V20l-6-4-6 4V4.5a.5.5 0 0 1 .5-.5Z"/></svg></button>' : '') +
      '</li>';
  }

  function refreshLocal() {
    var favList = favs.all();
    var favSet = {};
    favList.forEach(function (f) { favSet[f.u] = true; });
    var prog = progress.all();
    var recentList = recent.all();

    $$('[data-kg-fav]').forEach(function (b) {
      var on = !!favSet[key(b.getAttribute('data-kg-fav'))];
      b.setAttribute('aria-pressed', String(on));
      var label = $('[data-kg-fav-label]', b);
      if (label) label.textContent = on ? '已收藏' : '收藏';
    });
    $$('[data-kg-fav-count]').forEach(function (el) {
      el.hidden = !favList.length;
      el.textContent = favList.length > 99 ? '99+' : favList.length;
    });
    $$('[data-kg-doc]').forEach(function (el) {
      var k = key(el.getAttribute('data-kg-doc'));
      var p = prog[k] || 0;
      el.classList.toggle('is-read', p >= 97);
      el.classList.toggle('is-fav', !!favSet[k]);
      var slot = $('[data-kg-progress]', el);
      if (!slot) return;
      slot.hidden = p < 2;
      slot.style.setProperty('--p', p + '%');
      slot.textContent = p >= 97 ? '已读' : p + '%';
    });
    $$('[data-kg-list]').forEach(function (ul) {
      var type = ul.getAttribute('data-kg-list');
      var limit = parseInt(ul.getAttribute('data-limit') || '8', 10);
      var mod = ul.getAttribute('data-module');
      var items = type === 'favs' ? favList : recentList;
      if (type === 'continue') items = recentList.filter(function (r) { var p = prog[r.u] || 0; return p >= 2 && p < 97; });
      if (mod) items = items.filter(function (r) { return r.m === mod; });
      var total = items.length;
      items = items.slice(0, limit);
      ul.innerHTML = items.map(function (it) { return localItem(it, prog[it.u] || 0, type === 'favs'); }).join('');
      var wrap = ul.closest('[data-kg-list-wrap]') || ul.parentNode;
      var empty = $('[data-kg-list-empty]', wrap);
      if (empty) empty.hidden = total > 0;
      ul.hidden = total === 0;
      var count = $('[data-kg-list-count]', wrap);
      if (count) count.textContent = total;
      if (wrap.hasAttribute('data-kg-hide-empty')) wrap.hidden = total === 0;
    });
    emit('kg:local');
  }
  KG.refreshLocal = refreshLocal;

  function initLocal() {
    doc.addEventListener('click', function (e) {
      var b = e.target.closest('[data-kg-fav]');
      if (b) {
        e.preventDefault();
        favs.toggle(b.getAttribute('data-kg-fav'), b.getAttribute('data-title'), b.getAttribute('data-module'));
        if (!reduceMotion) { b.classList.remove('is-pop'); void b.offsetWidth; b.classList.add('is-pop'); }
        return;
      }
      var c = e.target.closest('[data-kg-clear]');
      if (c) {
        var what = c.getAttribute('data-kg-clear');
        var names = { favs: '收藏', recent: '最近阅读记录', progress: '阅读进度' };
        if (!window.confirm('确定清空' + (names[what] || '') + '吗？此操作只影响当前浏览器。')) return;
        store.set(what, what === 'progress' ? {} : []);
        refreshLocal();
        toast('已清空' + (names[what] || ''));
      }
    });
    refreshLocal();
  }

  /* ----------------------------------------------------------------- search */
  var search = { data: null, loading: null, module: '', active: -1, hits: [], lastFocus: null };

  function loadIndex() {
    if (search.data) return Promise.resolve(search.data);
    if (search.loading) return search.loading;
    search.loading = fetch(KG.index, { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (list) {
        list.forEach(function (d) {
          d._t = (d.t || '').toLowerCase();
          d._s = ((d.s || '') + ' ' + (d.g || []).join(' ') + ' ' + (d.k || '')).toLowerCase();
          d._c = (d.c || '').toLowerCase();
        });
        search.data = list;
        return list;
      })
      .catch(function (err) { search.loading = null; throw err; });
    return search.loading;
  }
  KG.loadIndex = loadIndex;

  function tokenize(q) {
    return q.toLowerCase().split(/[\s,，、;；]+/).filter(Boolean).slice(0, 6);
  }
  function highlight(text, tokens) {
    var out = esc(text);
    if (!tokens.length) return out;
    var re = new RegExp('(' + tokens.map(function (t) { return escRe(esc(t)); }).join('|') + ')', 'gi');
    return out.replace(re, '<mark>$1</mark>');
  }
  function snippet(d, tokens) {
    var c = d.c || '';
    var pos = -1;
    for (var i = 0; i < tokens.length && pos < 0; i++) pos = d._c.indexOf(tokens[i]);
    if (pos < 0) return highlight(c.slice(0, 110), tokens);
    var start = Math.max(0, pos - 36);
    return (start > 0 ? '…' : '') + highlight(c.slice(start, start + 130), tokens) + '…';
  }
  function query(list, q, module) {
    var tokens = tokenize(q);
    var out = [];
    if (!tokens.length) return { tokens: tokens, hits: out };
    list.forEach(function (d) {
      if (module && d.m !== module) return;
      var score = 0;
      for (var i = 0; i < tokens.length; i++) {
        var tk = tokens[i], s = 0;
        var ti = d._t.indexOf(tk);
        if (ti >= 0) s += d._t === tk ? 40 : (ti === 0 ? 26 : 18);
        if (d._s.indexOf(tk) >= 0) s += 8;
        var ci = d._c.indexOf(tk);
        if (ci >= 0) {
          var n = 0, from = ci;
          while (from >= 0 && n < 12) { n++; from = d._c.indexOf(tk, from + tk.length); }
          s += 2 + Math.min(n, 12) * 0.6;
        }
        if (!s) return;
        score += s;
      }
      out.push({ d: d, score: score });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return { tokens: tokens, hits: out.slice(0, 40) };
  }
  KG.query = query;

  function initSearch() {
    var box = $('[data-kg-search]');
    if (!box) return;
    var input = $('[data-kg-search-input]', box);
    var results = $('[data-kg-search-results]', box);
    var status = $('[data-kg-search-status]', box);
    var timer = null;

    function setActive(i) {
      var items = $$('.kg-hit', results);
      if (!items.length) { search.active = -1; return; }
      search.active = (i + items.length) % items.length;
      items.forEach(function (li, idx) {
        var on = idx === search.active;
        li.classList.toggle('is-active', on);
        li.setAttribute('aria-selected', String(on));
        if (on) li.scrollIntoView({ block: 'nearest' });
      });
    }

    function render() {
      var q = input.value.trim();
      if (!q) {
        var rec = recent.all().slice(0, 6);
        status.textContent = rec.length ? '最近阅读' : '输入关键词，搜索全部文章与知识库';
        results.innerHTML = rec.map(function (r) {
          return '<li class="kg-hit" role="option"><a href="' + esc(encodeURI(r.u)) + '"><span class="kg-hit__top"><span class="kg-hit__title">' +
            esc(r.t) + '</span><span class="kg-hit__meta">' + esc(r.m || '') + ' · ' + timeAgo(r.ts) + '</span></span></a></li>';
        }).join('');
        search.active = -1;
        return;
      }
      status.textContent = '正在加载索引…';
      loadIndex().then(function (list) {
        if (input.value.trim() !== q) return;
        var res = query(list, q, search.module);
        search.tokens = res.tokens;
        status.textContent = res.hits.length ? '找到 ' + res.hits.length + (res.hits.length === 40 ? '+' : '') + ' 条结果' : '没有找到与「' + q + '」相关的内容，换个关键词试试';
        results.innerHTML = res.hits.map(function (h) {
          var d = h.d;
          return '<li class="kg-hit" role="option" style="--hue:' + (d.h || 218) + '"><a href="' + esc(d.u) + '">' +
            '<span class="kg-hit__top"><span class="kg-hit__title">' + highlight(d.t, res.tokens) + '</span>' +
            '<span class="kg-hit__meta kg-dot-label">' + esc(d.k || d.n || '') + '</span></span>' +
            '<span class="kg-hit__snippet">' + snippet(d, res.tokens) + '</span></a></li>';
        }).join('');
        setActive(0);
      }).catch(function () {
        status.textContent = '搜索索引加载失败，请检查网络后重试';
        results.innerHTML = '';
      });
    }

    function open(preset) {
      if (!box.hidden) return;
      search.lastFocus = doc.activeElement;
      box.hidden = false;
      doc.body.classList.add('kg-lock');
      if (typeof preset === 'string') input.value = preset;
      render();
      loadIndex().catch(function () {});
      setTimeout(function () { input.focus(); input.select(); }, 30);
    }
    function close() {
      if (box.hidden) return;
      box.hidden = true;
      doc.body.classList.remove('kg-lock');
      if (search.lastFocus && search.lastFocus.focus) search.lastFocus.focus();
    }
    KG.openSearch = open;

    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(render, 90);
    });
    box.addEventListener('click', function (e) {
      if (e.target.closest('[data-kg-search-close]')) { close(); return; }
      var chip = e.target.closest('[data-kg-search-module]');
      if (chip) {
        search.module = chip.getAttribute('data-kg-search-module');
        $$('[data-kg-search-module]', box).forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
        render();
        input.focus();
        return;
      }
      var hit = e.target.closest('.kg-hit a');
      if (hit && search.tokens && input.value.trim()) {
        try { sessionStorage.setItem('kg:hl', JSON.stringify({ u: key(hit.getAttribute('href')), q: search.tokens })); } catch (err) {}
      }
    });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(search.active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(search.active - 1); }
      else if (e.key === 'Enter') {
        var a = $('.kg-hit.is-active a', results) || $('.kg-hit a', results);
        if (a) { e.preventDefault(); a.click(); }
      } else if (e.key === 'Tab') {
        // keep focus inside the dialog
        var f = $$('input, button, a[href]', box).filter(function (el) { return el.offsetParent !== null; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    doc.addEventListener('click', function (e) {
      var t = e.target.closest('[data-kg-search-open]');
      if (!t) return;
      e.preventDefault();
      open(t.getAttribute('data-q') || '');
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !box.hidden) { close(); return; }
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) || e.target.isContentEditable;
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); box.hidden ? open('') : close(); }
      else if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); open(''); }
    });
    // Mac users see the ⌘ glyph
    if (/Mac|iPhone|iPad/.test(navigator.platform || '')) {
      $$('.kg-search-trigger kbd, [data-kg-kbd]').forEach(function (k) { k.textContent = '⌘ K'; });
    }
  }

  /* ------------------------------------------------------------------- boot */
  function boot() {
    initTheme();
    initNav();
    initSurface();
    initLocal();
    initSearch();
    KG.ready = true;
    emit('kg:ready');
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
