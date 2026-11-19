/* Knowledge Garden · library (module / tag / keyword filters over the server-rendered list) */
(function () {
  'use strict';

  function start() {
    var KG = window.KG, $ = KG.$, $$ = KG.$$;
    var rootEl = $('[data-kg-library]');
    if (!rootEl) return;
    var list = $('[data-lib-list]', rootEl);
    var input = $('[data-lib-q]', rootEl);
    var sortSel = $('[data-lib-sort]', rootEl);
    var shown = $('[data-lib-shown]', rootEl);
    var empty = $('[data-lib-empty]', rootEl);
    var resetBtn = $('[data-lib-reset]', rootEl);

    var items = $$('.kg-entry', list).map(function (el, i) {
      return {
        el: el, i: i,
        key: KG.key(el.getAttribute('data-kg-doc')),
        module: el.getAttribute('data-module'),
        tags: (el.getAttribute('data-tags') || '').split('|').filter(Boolean),
        title: el.getAttribute('data-title') || '',
        date: el.getAttribute('data-date') || '',
        text: (el.textContent || '').toLowerCase(),
        titleEl: $('.kg-entry__title', el)
      };
    });

    // Per-module counts on the chips
    var counts = {};
    items.forEach(function (it) { counts[it.module] = (counts[it.module] || 0) + 1; });
    $$('[data-lib-count]', rootEl).forEach(function (el) { el.textContent = counts[el.getAttribute('data-lib-count')] || 0; });

    var params = new URLSearchParams(location.search);
    var state = {
      q: params.get('q') || '',
      module: params.get('m') || '',
      tag: params.get('tag') || '',
      fav: params.get('fav') === '1',
      unread: params.get('unread') === '1',
      sort: params.get('sort') || ''
    };
    var indexHits = null; // key -> score, from the full-text index

    function syncControls() {
      input.value = state.q;
      sortSel.value = state.sort;
      $$('[data-lib-module]', rootEl).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lib-module') === state.module)); });
      $$('[data-lib-tag]', rootEl).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lib-tag') === state.tag)); });
      $$('[data-lib-flag]', rootEl).forEach(function (b) { b.setAttribute('aria-pressed', String(!!state[b.getAttribute('data-lib-flag')])); });
    }
    function syncUrl() {
      var p = new URLSearchParams();
      if (state.q) p.set('q', state.q);
      if (state.module) p.set('m', state.module);
      if (state.tag) p.set('tag', state.tag);
      if (state.fav) p.set('fav', '1');
      if (state.unread) p.set('unread', '1');
      if (state.sort) p.set('sort', state.sort);
      var qs = p.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
    }

    function apply() {
      var tokens = state.q.toLowerCase().split(/[\s,，、]+/).filter(Boolean);
      var favSet = {};
      KG.favs.all().forEach(function (f) { favSet[f.u] = true; });
      var prog = KG.progress.all();
      var re = tokens.length ? new RegExp('(' + tokens.map(function (t) { return KG.esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'gi') : null;
      var visible = [];

      items.forEach(function (it) {
        var ok = true;
        if (state.module && it.module !== state.module) ok = false;
        if (ok && state.tag && it.tags.indexOf(state.tag) < 0) ok = false;
        if (ok && state.fav && !favSet[it.key]) ok = false;
        if (ok && state.unread && (prog[it.key] || 0) >= 97) ok = false;
        var score = 0;
        if (ok && tokens.length) {
          var local = tokens.every(function (t) { return it.text.indexOf(t) >= 0; });
          if (local) score = 100;
          if (indexHits && indexHits[it.key]) score = Math.max(score, indexHits[it.key]);
          ok = score > 0;
        }
        it.el.hidden = !ok;
        it.score = score;
        it.titleEl.innerHTML = re ? KG.esc(it.title).replace(re, '<mark>$1</mark>') : KG.esc(it.title);
        it.el.classList.toggle('is-hit', !!re);
        if (ok) visible.push(it);
      });

      var order = items.slice();
      if (state.sort === 'title') order.sort(function (a, b) { return a.title.localeCompare(b.title, 'zh-Hans-CN'); });
      else if (state.sort === 'new') order.sort(function (a, b) { return (b.date || '0').localeCompare(a.date || '0') || a.i - b.i; });
      else if (state.sort === 'old') order.sort(function (a, b) { return (a.date || '99999999').localeCompare(b.date || '99999999') || a.i - b.i; });
      else if (tokens.length) order.sort(function (a, b) { return b.score - a.score || a.i - b.i; });
      else order.sort(function (a, b) { return a.i - b.i; });
      order.forEach(function (it) { list.appendChild(it.el); });

      shown.textContent = visible.length;
      empty.hidden = visible.length > 0;
      list.hidden = visible.length === 0;
      resetBtn.hidden = !(state.q || state.module || state.tag || state.fav || state.unread || state.sort);
    }

    function searchIndex() {
      if (!state.q.trim()) { indexHits = null; apply(); return; }
      var q = state.q;
      apply();
      KG.loadIndex().then(function (data) {
        if (q !== state.q) return;
        var res = KG.query(data, q, '');
        indexHits = {};
        res.hits.forEach(function (h) { indexHits[KG.key(h.d.u)] = h.score; });
        apply();
      }).catch(function () {});
    }

    var timer = null;
    input.addEventListener('input', function () {
      state.q = input.value.trim();
      clearTimeout(timer);
      timer = setTimeout(function () { syncUrl(); searchIndex(); }, 120);
    });
    sortSel.addEventListener('change', function () { state.sort = sortSel.value; syncUrl(); apply(); });
    rootEl.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-lib-module]'))) state.module = b.getAttribute('data-lib-module');
      else if ((b = e.target.closest('[data-lib-tag]'))) state.tag = b.getAttribute('data-lib-tag');
      else if ((b = e.target.closest('[data-lib-flag]'))) { var k = b.getAttribute('data-lib-flag'); state[k] = !state[k]; }
      else if (e.target.closest('[data-lib-reset]')) state = { q: '', module: '', tag: '', fav: false, unread: false, sort: '' };
      else return;
      indexHits = state.q ? indexHits : null;
      syncControls(); syncUrl(); apply();
    });
    // Favorites / progress changed elsewhere on the page
    document.addEventListener('kg:local', function () { if (state.fav || state.unread) apply(); });

    syncControls();
    searchIndex();
  }

  if (window.KG && window.KG.ready) start();
  else document.addEventListener('kg:ready', start);
})();
