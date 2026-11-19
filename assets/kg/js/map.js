/* Knowledge Garden · knowledge map (radial tree in SVG with pan / zoom / focus) */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var R1 = 190, R2 = 370, R3 = 540;

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function polar(r, a) { return { x: Math.cos(a) * r, y: Math.sin(a) * r }; }
  function clip(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  function start() {
    var KG = window.KG, $ = KG.$;
    var host = $('[data-kg-map]');
    var dataEl = document.getElementById('kg-map-data');
    if (!host || !dataEl) return;
    var data;
    try { data = JSON.parse(dataEl.textContent); } catch (e) { return; }

    /* ------------------------------------------------------- layout */
    var nodes = [], links = [];
    var root = { type: 'root', title: data.name, x: 0, y: 0, a: 0, hue: 218, children: [], parent: null };
    nodes.push(root);
    var GAP = 1.6, total = 0;
    data.modules.forEach(function (m) {
      m._w = 0;
      m.tracks.forEach(function (t) { t._w = Math.max(1.4, t.docs.length); m._w += t._w; });
      if (!m.tracks.length) m._w = 2;
      total += m._w + GAP;
    });
    var unit = (Math.PI * 2) / total;
    var cursor = -Math.PI / 2 - (data.modules[0]._w * unit) / 2;
    data.modules.forEach(function (m) {
      var a0 = cursor, a1 = cursor + m._w * unit;
      var mn = { type: 'module', title: m.title, url: m.url, hue: m.hue, a: (a0 + a1) / 2, r: R1, children: [], parent: root };
      root.children.push(mn); nodes.push(mn); links.push([root, mn]);
      var c = a0;
      m.tracks.forEach(function (t) {
        var t0 = c, t1 = c + t._w * unit;
        var tn = { type: 'track', title: t.title, url: t.url, hue: m.hue, a: (t0 + t1) / 2, r: R2, children: [], parent: mn };
        mn.children.push(tn); nodes.push(tn); links.push([mn, tn]);
        var step = (t1 - t0) / Math.max(1, t.docs.length);
        t.docs.forEach(function (d, i) {
          var dn = { type: 'doc', title: d.t, url: d.u, ext: !!d.x, hue: m.hue, a: t0 + step * (i + 0.5), r: R3, children: [], parent: tn, track: t.title };
          tn.children.push(dn); nodes.push(dn); links.push([tn, dn]);
        });
        c = t1;
      });
      cursor = a1 + GAP * unit;
    });
    nodes.forEach(function (n) { if (n.type !== 'root') { var p = polar(n.r, n.a); n.x = p.x; n.y = p.y; } });

    /* ---------------------------------------------------------- DOM */
    var svg = el('svg', { role: 'group', 'aria-label': '知识地图：模块、专题与文档的关系图' });
    var view = el('g', { 'class': 'm-view' }, svg);
    [R1, R2, R3].forEach(function (r) { el('circle', { 'class': 'm-ring', cx: 0, cy: 0, r: r, 'vector-effect': 'non-scaling-stroke' }, view); });
    var gLinks = el('g', {}, view), gNodes = el('g', {}, view);

    links.forEach(function (l) {
      var p = l[0], c = l[1];
      var d;
      if (p.type === 'root') d = 'M0,0L' + c.x.toFixed(1) + ',' + c.y.toFixed(1);
      else {
        var rm = (p.r + c.r) / 2, c1 = polar(rm, p.a), c2 = polar(rm, c.a);
        d = 'M' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + 'C' + c1.x.toFixed(1) + ',' + c1.y.toFixed(1) + ' ' + c2.x.toFixed(1) + ',' + c2.y.toFixed(1) + ' ' + c.x.toFixed(1) + ',' + c.y.toFixed(1);
      }
      c.link = el('path', { 'class': 'm-link', d: d, style: '--hue:' + c.hue, 'vector-effect': 'non-scaling-stroke' }, gLinks);
    });

    var RADIUS = { root: 34, module: 11, track: 6.5, doc: 4.5 };
    nodes.forEach(function (n) {
      var tag = (n.type === 'doc' || n.type === 'track') ? 'a' : 'g';
      var g = el(tag, { 'class': 'm-node m-node--' + n.type, style: '--hue:' + n.hue }, gNodes);
      if (tag === 'a') {
        g.setAttribute('href', n.url);
        if (n.ext) { g.setAttribute('target', '_blank'); g.setAttribute('rel', 'noopener'); }
      } else {
        g.setAttribute('tabindex', '0');
        g.setAttribute('role', 'button');
      }
      g.setAttribute('aria-label', (n.type === 'module' ? '聚焦模块：' : '') + n.title);
      n.g = g;
      n.inner = el('g', {}, g); // counter-scaled so sizes stay in screen pixels
      el('circle', { r: RADIUS[n.type] }, n.inner);
      var cos = Math.cos(n.a), sin = Math.sin(n.a);
      var t;
      if (n.type === 'root') {
        t = el('text', { y: 4.5 }, n.inner); t.textContent = n.title;
      } else if (n.type === 'doc') {
        var deg = (n.a * 180) / Math.PI, flip = cos < 0;
        t = el('text', { x: flip ? -11 : 11, y: 4, transform: 'rotate(' + (flip ? deg + 180 : deg).toFixed(2) + ')', style: 'text-anchor:' + (flip ? 'end' : 'start') }, n.inner);
        t.textContent = clip(n.title, 11);
        t.setAttribute('class', 'm-doc-label');
      } else {
        var off = n.type === 'module' ? 22 : 13;
        var anchor = Math.abs(cos) < 0.35 ? 'middle' : (cos > 0 ? 'start' : 'end');
        t = el('text', { x: (cos * off).toFixed(1), y: (sin * off + 4.5 + (anchor === 'middle' ? sin * 8 : 0)).toFixed(1), style: 'text-anchor:' + anchor + ';paint-order:stroke;stroke:var(--kg-bg);stroke-width:4px;stroke-linejoin:round' }, n.inner);
        t.textContent = n.title;
      }
      g._n = n;
    });
    host.insertBefore(svg, host.firstChild);
    var tip = document.createElement('div');
    tip.className = 'kg-map__tip';
    tip.hidden = true;
    host.appendChild(tip);

    /* ------------------------------------------------ view transform */
    var st = { s: 1, tx: 0, ty: 0 };
    var touched = false, anim = 0;
    function apply() {
      view.setAttribute('transform', 'translate(' + st.tx.toFixed(2) + ',' + st.ty.toFixed(2) + ') scale(' + st.s.toFixed(4) + ')');
      var inv = 1 / st.s;
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        n.inner.setAttribute('transform', 'translate(' + n.x.toFixed(1) + ',' + n.y.toFixed(1) + ') scale(' + inv.toFixed(4) + ')');
      }
      svg.classList.toggle('hide-doc-labels', unit * R3 * st.s < 13);
    }
    function fitBox(x0, y0, x1, y1, pad) {
      var w = host.clientWidth, h = host.clientHeight;
      var s = Math.min((w - pad * 2) / Math.max(1, x1 - x0), (h - pad * 2) / Math.max(1, y1 - y0));
      s = Math.max(0.12, Math.min(3.2, s));
      return { s: s, tx: w / 2 - ((x0 + x1) / 2) * s, ty: h / 2 - ((y0 + y1) / 2) * s };
    }
    function fitAll() {
      var m = Math.min(host.clientWidth, host.clientHeight);
      var labelPx = (unit * R3 * ((m / 2 - 150) / R3) >= 13) ? 132 : 16;
      return fitBox(-R3, -R3, R3, R3, labelPx + 14);
    }
    function go(target, animate) {
      cancelAnimationFrame(anim);
      if (!animate || KG.reduceMotion) { st = target; apply(); return; }
      var from = { s: st.s, tx: st.tx, ty: st.ty }, t0 = performance.now();
      (function tick(now) {
        var k = Math.min(1, (now - t0) / 520), e = 1 - Math.pow(1 - k, 3);
        st = { s: from.s + (target.s - from.s) * e, tx: from.tx + (target.tx - from.tx) * e, ty: from.ty + (target.ty - from.ty) * e };
        apply();
        if (k < 1) anim = requestAnimationFrame(tick);
      })(t0);
    }
    function zoomAt(cx, cy, factor) {
      var s = Math.max(0.12, Math.min(4, st.s * factor));
      var k = s / st.s;
      st = { s: s, tx: cx - (cx - st.tx) * k, ty: cy - (cy - st.ty) * k };
      apply();
    }

    /* ------------------------------------------------ focus & hover */
    var focus = null;
    function subtree(n, out) { out.push(n); n.children.forEach(function (c) { subtree(c, out); }); return out; }
    function ancestors(n, out) { while (n) { out.push(n); n = n.parent; } return out; }
    function paint(hot) {
      nodes.forEach(function (n) { n.g.classList.remove('is-hot'); if (n.link) n.link.classList.remove('is-hot'); });
      svg.classList.toggle('has-focus', !!hot);
      if (!hot) return;
      hot.forEach(function (n) { n.g.classList.add('is-hot'); if (n.link) n.link.classList.add('is-hot'); });
    }
    function focusSet() { return focus ? ancestors(focus, []).concat(subtree(focus, [])) : null; }
    function setFocus(n) {
      focus = n;
      paint(focusSet());
      if (!n) { go(fitAll(), true); return; }
      var pts = subtree(n, [root]);
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      pts.forEach(function (p) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
      go(fitBox(x0, y0, x1, y1, Math.min(150, host.clientWidth * 0.16)), true);
    }

    /* ------------------------------------------------- interactions */
    var pointers = {}, drag = null, moved = false, pinch = 0;
    function local(e) { var r = host.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    svg.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      pointers[e.pointerId] = local(e);
      var ids = Object.keys(pointers);
      moved = false;
      cancelAnimationFrame(anim);
      if (ids.length === 1) drag = { x: e.clientX, y: e.clientY, tx: st.tx, ty: st.ty };
      else if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        pinch = Math.hypot(a.x - b.x, a.y - b.y); drag = null; moved = true;
      }
    });
    svg.addEventListener('pointermove', function (e) {
      if (!pointers[e.pointerId]) return;
      pointers[e.pointerId] = local(e);
      var ids = Object.keys(pointers);
      if (ids.length === 2 && pinch) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch);
        pinch = d; touched = true;
      } else if (drag) {
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!moved && Math.hypot(dx, dy) < 5) return;
        if (!moved) { moved = true; svg.classList.add('is-drag'); try { svg.setPointerCapture(e.pointerId); } catch (err) {} }
        st.tx = drag.tx + dx; st.ty = drag.ty + dy; touched = true;
        apply();
      }
    });
    function up(e) {
      delete pointers[e.pointerId];
      if (Object.keys(pointers).length < 2) pinch = 0;
      drag = null;
      svg.classList.remove('is-drag');
    }
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      var p = local(e);
      zoomAt(p.x, p.y, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)));
      touched = true;
    }, { passive: false });

    svg.addEventListener('click', function (e) {
      if (moved) { e.preventDefault(); moved = false; return; }
      var g = e.target.closest('.m-node');
      if (!g) { if (focus) setFocus(null); return; }
      var n = g._n;
      if (n.type === 'module') { touched = true; setFocus(focus === n ? null : n); }
      else if (n.type === 'root') { touched = false; setFocus(null); }
    });
    svg.addEventListener('keydown', function (e) {
      var g = e.target.closest && e.target.closest('.m-node');
      if (!g || (e.key !== 'Enter' && e.key !== ' ')) return;
      var n = g._n;
      if (n.type === 'module' || n.type === 'root') { e.preventDefault(); setFocus(n.type === 'root' || focus === n ? null : n); }
    });
    function hover(n, e) {
      if (!n) { tip.hidden = true; paint(focusSet()); return; }
      paint(ancestors(n, []).concat(n.type === 'doc' ? [] : subtree(n, [])));
      if (n.type === 'doc') {
        var r = host.getBoundingClientRect(), b = n.g.querySelector('circle').getBoundingClientRect();
        tip.innerHTML = KG.esc(n.title) + '<small>' + KG.esc(n.parent.parent.title + ' · ' + n.track) + '</small>';
        tip.style.left = Math.max(120, Math.min(r.width - 120, b.left + b.width / 2 - r.left)) + 'px';
        tip.style.top = Math.max(60, b.top - r.top) + 'px';
        tip.hidden = false;
      } else tip.hidden = true;
    }
    svg.addEventListener('pointerover', function (e) { var g = e.target.closest('.m-node'); if (g && e.pointerType !== 'touch') hover(g._n, e); });
    svg.addEventListener('pointerout', function (e) { var g = e.target.closest('.m-node'); if (g && !g.contains(e.relatedTarget)) hover(null); });
    svg.addEventListener('focusin', function (e) { var g = e.target.closest('.m-node'); if (g) hover(g._n); });
    svg.addEventListener('focusout', function () { hover(null); });

    host.addEventListener('click', function (e) {
      var z = e.target.closest('[data-map-zoom]');
      if (z) { touched = true; var f = parseFloat(z.getAttribute('data-map-zoom')); var from = { s: st.s, tx: st.tx, ty: st.ty }; zoomAt(host.clientWidth / 2, host.clientHeight / 2, f); var to = st; st = from; go(to, true); return; }
      if (e.target.closest('[data-map-reset]')) { touched = false; setFocus(null); }
    });

    /* ----------------------------------------- local reading state */
    function syncState() {
      var prog = KG.progress.all(), favs = {};
      KG.favs.all().forEach(function (f) { favs[f.u] = true; });
      nodes.forEach(function (n) {
        if (n.type !== 'doc' || n.ext) return;
        var k = KG.key(n.url);
        n.g.classList.toggle('is-read', (prog[k] || 0) >= 97);
        n.g.classList.toggle('is-fav', !!favs[k]);
      });
    }
    document.addEventListener('kg:local', syncState);
    syncState();

    if ('ResizeObserver' in window) new ResizeObserver(function () { if (!touched && !focus) go(fitAll(), false); else apply(); }).observe(host);
    go(fitAll(), false);
  }

  if (window.KG && window.KG.ready) start();
  else document.addEventListener('kg:ready', start);
})();
