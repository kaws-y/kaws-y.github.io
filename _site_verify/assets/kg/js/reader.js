/* Knowledge Garden · reading page (TOC, scrollspy, progress, resume, code tools, drawers) */
(function () {
  'use strict';

  function start() {
    var KG = window.KG, $ = KG.$, $$ = KG.$$;
    var reader = $('[data-kg-reader]');
    var prose = $('[data-kg-prose]');
    if (!reader || !prose) return;

    var url = reader.getAttribute('data-url');
    var title = reader.getAttribute('data-title');
    var moduleName = reader.getAttribute('data-module');
    var docKey = KG.key(url);
    document.body.classList.add('kg-autohide');

    /* ---------------------------------------------------- content polish */
    $$('table', prose).forEach(function (t) {
      if (t.closest('.highlight') || t.parentNode.classList.contains('kg-tablewrap')) return;
      var w = document.createElement('div');
      w.className = 'kg-tablewrap';
      w.setAttribute('tabindex', '0');
      w.setAttribute('role', 'region');
      w.setAttribute('aria-label', '表格（可横向滚动）');
      t.parentNode.insertBefore(w, t);
      w.appendChild(t);
    });

    $$('pre', prose).forEach(function (pre) {
      var block = pre.closest('.highlighter-rouge') || pre;
      if (block.tagName !== 'PRE' && block.tagName !== 'DIV') return;
      if (block.parentNode.classList.contains('kg-codewrap')) return;
      var wrap = document.createElement('div');
      wrap.className = 'kg-codewrap';
      var lang = ((block.className + ' ' + pre.className + ' ' + ((pre.querySelector('code') || {}).className || '')).match(/language-([\w+#-]+)/) || [])[1];
      if (lang && lang !== 'plaintext') wrap.setAttribute('data-lang', lang);
      block.parentNode.insertBefore(wrap, block);
      wrap.appendChild(block);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'kg-copy';
      btn.textContent = '复制';
      btn.addEventListener('click', function () {
        var text = (pre.querySelector('code') || pre).innerText;
        var done = function () { btn.textContent = '已复制'; setTimeout(function () { btn.textContent = '复制'; }, 1600); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { KG.toast('复制失败，请手动选择'); });
        } else {
          var ta = document.createElement('textarea');
          ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); done(); } catch (e) { KG.toast('复制失败，请手动选择'); }
          ta.remove();
        }
      });
      wrap.appendChild(btn);
    });

    // External links open in a new tab; relative *.md links (knowledge base sources) map to their pages.
    var srcPath = reader.getAttribute('data-src') || '';
    var srcDir = srcPath.indexOf('/') >= 0 ? srcPath.slice(0, srcPath.lastIndexOf('/') + 1) : '';
    $$('a[href]', prose).forEach(function (a) {
      var href = a.getAttribute('href');
      if (/^https?:\/\//i.test(href)) {
        if (a.host !== location.host) { a.target = '_blank'; a.rel = 'noopener'; }
        return;
      }
      if (/^[a-z]+:/i.test(href) || href.charAt(0) === '#' || href.charAt(0) === '/') return;
      var m = href.match(/^([^?#]*)\.md(#.*)?$/i);
      if (!m) return;
      try {
        var abs = new URL(m[1], location.origin + (KG.base || '') + '/' + srcDir).pathname;
        abs = /\/README$/i.test(abs) ? abs.replace(/README$/i, '') : abs + '/';
        a.setAttribute('href', abs + (m[2] || ''));
      } catch (e) {}
    });

    /* --------------------------------------------------------- headings */
    var isDoc = prose.classList.contains('kg-prose--doc');
    var heads = $$('h1, h2, h3, h4', prose).filter(function (h) {
      if (h.closest('blockquote, .kg-tablewrap')) return false;
      if (isDoc && h.tagName === 'H1' && h === prose.firstElementChild) return false;
      return h.textContent.trim().length > 0;
    });
    var used = {};
    $$('[id]').forEach(function (el) { used[el.id] = true; });
    heads.forEach(function (h, i) {
      if (!h.id) {
        var id = 'sec-' + (i + 1);
        while (used[id]) id += '-x';
        h.id = id; used[id] = true;
      }
      var a = document.createElement('a');
      a.className = 'kg-anchor';
      a.href = '#' + encodeURIComponent(h.id);
      a.setAttribute('aria-label', '本节链接');
      a.textContent = '#';
      h.insertBefore(a, h.firstChild);
    });

    /* -------------------------------------------------------------- TOC */
    var toc = $('[data-kg-toc]');
    var links = [];
    if (toc && heads.length) {
      var min = 6;
      heads.forEach(function (h) { min = Math.min(min, +h.tagName.slice(1)); });
      var frag = document.createDocumentFragment();
      heads.forEach(function (h) {
        var depth = +h.tagName.slice(1) - min;
        if (depth > 2) return;
        var a = document.createElement('a');
        a.href = '#' + encodeURIComponent(h.id);
        a.textContent = h.textContent.replace(/^#/, '').trim();
        a.style.setProperty('--d', depth);
        a.setAttribute('data-d', depth);
        frag.appendChild(a);
        links.push({ a: a, h: h });
      });
      toc.appendChild(frag);
      // Long documents: keep only two levels to stay scannable
      if (links.length > 46) {
        links = links.filter(function (l) {
          if (l.a.getAttribute('data-d') === '2') { l.a.remove(); return false; }
          return true;
        });
      }
    }
    var tocSide = $('.kg-reader__side--toc');
    if (tocSide && !links.length) tocSide.classList.add('is-empty');

    /* ------------------------------------- scroll: progress + scrollspy */
    var bar = $('[data-kg-progressbar] i');
    var ring = $('[data-kg-ring]');
    var pctEls = $$('[data-kg-percent]');
    var positions = KG.store.get('pos', {});
    var maxPct = KG.progress.get(docKey);
    var lastPct = -1, activeIdx = -1, ticking = false, saveTimer = null;
    var navOffset = 96;

    function metrics() {
      var rect = prose.getBoundingClientRect();
      var top = rect.top + window.pageYOffset;
      var startY = Math.max(0, top - navOffset);
      var endY = top + rect.height - window.innerHeight * 0.72;
      return { start: startY, end: Math.max(endY, startY + 1) };
    }
    function ratio() {
      var m = metrics();
      if (document.documentElement.scrollHeight - window.innerHeight < 40) return 1;
      return Math.max(0, Math.min(1, (window.pageYOffset - m.start) / (m.end - m.start)));
    }
    function save() {
      saveTimer = null;
      var r = ratio();
      positions[docKey] = Math.round(r * 1000) / 1000;
      KG.store.set('pos', positions);
      if (maxPct > KG.progress.get(docKey)) KG.progress.set(docKey, maxPct);
    }
    function update() {
      ticking = false;
      var r = ratio();
      var pct = Math.round(r * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        if (bar) bar.style.setProperty('--p', r.toFixed(4));
        if (ring) ring.style.setProperty('--p', r.toFixed(4));
        pctEls.forEach(function (el) { el.textContent = pct + '%'; });
        if (pct > maxPct) maxPct = pct;
        if (!saveTimer) saveTimer = setTimeout(save, 500);
      }
      if (links.length) {
        var idx = -1;
        for (var i = 0; i < links.length; i++) {
          if (links[i].h.getBoundingClientRect().top - navOffset - 12 <= 0) idx = i; else break;
        }
        if (idx !== activeIdx) {
          if (activeIdx >= 0) links[activeIdx].a.classList.remove('is-active');
          activeIdx = idx;
          if (idx >= 0) {
            var a = links[idx].a;
            a.classList.add('is-active');
            var box = a.closest('.kg-reader__sticky');
            if (box && box.scrollHeight > box.clientHeight) {
              var ar = a.getBoundingClientRect(), br = box.getBoundingClientRect();
              if (ar.top < br.top + 40 || ar.bottom > br.bottom - 40) box.scrollTop += ar.top - br.top - br.height / 2;
            }
          }
        }
      }
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });

    /* ------------------------------------------------ recent + resume */
    KG.recent.push(docKey, title, moduleName);
    var resumeBtn = $('[data-kg-resume]');
    var savedPos = positions[docKey] || 0;
    if (resumeBtn && savedPos > 0.06 && savedPos < 0.96 && !location.hash && window.pageYOffset < 80) {
      resumeBtn.hidden = false;
      $('span', resumeBtn).textContent = '继续上次阅读 · ' + Math.round(savedPos * 100) + '%';
      resumeBtn.addEventListener('click', function () {
        var m = metrics();
        window.scrollTo({ top: m.start + (m.end - m.start) * savedPos, behavior: KG.reduceMotion ? 'auto' : 'smooth' });
        resumeBtn.hidden = true;
      });
      window.addEventListener('scroll', function hide() {
        if (window.pageYOffset > 400) { resumeBtn.hidden = true; window.removeEventListener('scroll', hide); }
      }, { passive: true });
    }
    update();
    KG.refreshLocal();

    /* ------------------------------ highlight terms coming from search */
    try {
      var hl = JSON.parse(sessionStorage.getItem('kg:hl') || 'null');
      sessionStorage.removeItem('kg:hl');
      if (hl && hl.u === docKey && hl.q && hl.q.length) {
        var re = new RegExp('(' + hl.q.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'gi');
        var walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
          acceptNode: function (n) {
            if (!n.nodeValue.trim() || n.parentNode.closest('pre, script, style, .kg-anchor, mjx-container')) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        });
        var nodes = [], n;
        while ((n = walker.nextNode())) nodes.push(n);
        var count = 0, first = null;
        nodes.forEach(function (node) {
          if (count > 60) return;
          re.lastIndex = 0;
          if (!re.test(node.nodeValue)) return;
          var span = document.createElement('span');
          span.innerHTML = KG.esc(node.nodeValue).replace(re, '<mark class="kg-mark">$1</mark>');
          var marks = span.querySelectorAll('mark');
          count += marks.length;
          if (!first) first = marks[0];
          while (span.firstChild) node.parentNode.insertBefore(span.firstChild, node);
          node.remove();
        });
        if (first) {
          first.classList.add('kg-mark--flash');
          setTimeout(function () { first.scrollIntoView({ block: 'center', behavior: KG.reduceMotion ? 'auto' : 'smooth' }); }, 250);
          KG.toast('已高亮 ' + count + (count > 60 ? '+' : '') + ' 处匹配');
        }
      }
    } catch (e) {}

    /* ---------------------------------------------------------- drawers */
    var scrim = $('.kg-drawer-scrim');
    function closeDrawers() {
      $$('[data-kg-drawer]').forEach(function (d) { d.classList.remove('is-open'); });
      if (scrim) scrim.hidden = true;
    }
    document.addEventListener('click', function (e) {
      var opener = e.target.closest('[data-kg-drawer-open]');
      if (opener) {
        var name = opener.getAttribute('data-kg-drawer-open');
        var target = $('[data-kg-drawer="' + name + '"]');
        var wasOpen = target && target.classList.contains('is-open');
        closeDrawers();
        if (target && !wasOpen) { target.classList.add('is-open'); if (scrim) scrim.hidden = false; }
        return;
      }
      if (e.target.closest('[data-kg-drawer-close]')) { closeDrawers(); return; }
      if (e.target.closest('[data-kg-drawer] a')) closeDrawers();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawers(); });

    /* ------------------------------------------------ comments (lazy) */
    var gt = $('[data-kg-gitalk]');
    if (gt) {
      var loadScript = function (src) {
        return new Promise(function (res, rej) {
          var s = document.createElement('script');
          s.src = src; s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      };
      var boot = function () {
        var css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://unpkg.com/gitalk/dist/gitalk.css';
        document.head.appendChild(css);
        Promise.all([loadScript('https://unpkg.com/gitalk@latest/dist/gitalk.min.js'), loadScript(gt.getAttribute('data-md5'))])
          .then(function () {
            gt.innerHTML = '';
            new window.Gitalk({
              clientID: gt.getAttribute('data-client-id'),
              clientSecret: gt.getAttribute('data-client-secret'),
              repo: gt.getAttribute('data-repo'),
              owner: gt.getAttribute('data-owner'),
              admin: [gt.getAttribute('data-admin')],
              distractionFreeMode: gt.getAttribute('data-distraction-free') === 'true',
              id: window.md5(location.pathname)
            }).render('gitalk-container');
          })
          .catch(function () { gt.innerHTML = '<p class="kg-muted">评论组件加载失败，请稍后刷新重试。</p>'; });
      };
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (en) {
          if (en[0].isIntersecting) { io.disconnect(); boot(); }
        }, { rootMargin: '600px 0px' });
        io.observe(gt);
      } else boot();
    }
  }

  if (window.KG && window.KG.ready) start();
  else document.addEventListener('kg:ready', start);
})();
