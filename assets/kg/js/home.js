/* Knowledge Garden · home (on-demand 3D space, hero parallax, stat counters) */
(function () {
  'use strict';

  function webglAvailable(strict) {
    try {
      var c = document.createElement('canvas');
      var opts = strict ? { failIfMajorPerformanceCaveat: true } : undefined;
      var gl = c.getContext('webgl2', opts) || c.getContext('webgl', opts);
      if (!gl) return false;
      var ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      return true;
    } catch (e) { return false; }
  }

  function start() {
    var KG = window.KG, $ = KG.$, $$ = KG.$$;

    /* ----------------------------------------------------- 3D space */
    var host = $('[data-kg-space]');
    if (host) {
      var force = /[?&]space=force/.test(location.search);
      var conn = navigator.connection || {};
      var lowEnd = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '') || (navigator.deviceMemory && navigator.deviceMemory <= 2);
      var small = window.innerWidth < 760;
      if ((force || !lowEnd) && webglAvailable(!force)) {
        var load = function () {
          var url = (KG.base || '') + '/assets/kg/js/space.js' + (KG.index.match(/\?v=.*/) || [''])[0];
          var importer;
          try { importer = new Function('u', 'return import(u)'); } catch (e) { return; }
          importer(url).then(function (mod) {
            mod.mount(host, { theme: KG.theme(), reduceMotion: KG.reduceMotion, lite: small });
            requestAnimationFrame(function () { requestAnimationFrame(function () { host.classList.add('is-live'); }); });
          }).catch(function () { /* keep the CSS fallback scene */ });
        };
        var idle = function () {
          if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 1500 }); else setTimeout(load, 200);
        };
        if (document.readyState === 'complete') idle(); else window.addEventListener('load', idle);
      }
    }

    /* ----------------------------------- hero glass cards parallax */
    var stage = $('.kg-hero__stage');
    if (stage && !KG.reduceMotion && window.matchMedia('(hover: hover)').matches) {
      var cards = $$('.kg-hero__card', stage);
      var pending = false, px = 0, py = 0;
      window.addEventListener('pointermove', function (e) {
        px = (e.clientX / window.innerWidth) * 2 - 1;
        py = (e.clientY / window.innerHeight) * 2 - 1;
        if (pending) return;
        pending = true;
        requestAnimationFrame(function () {
          pending = false;
          cards.forEach(function (c) { c.style.setProperty('--px', px.toFixed(3)); c.style.setProperty('--py', py.toFixed(3)); });
        });
      }, { passive: true });
    }

    /* ------------------------------------------------ stat counters */
    var counters = $$('[data-kg-count]');
    if (counters.length && !KG.reduceMotion && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          var el = en.target, to = parseInt(el.getAttribute('data-kg-count'), 10) || 0, t0 = performance.now(), dur = 900;
          (function tick(now) {
            var k = Math.min(1, (now - t0) / dur);
            el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
            if (k < 1) requestAnimationFrame(tick);
          })(t0);
        });
      }, { threshold: 0.4 });
      counters.forEach(function (el) { io.observe(el); });
    }
  }

  if (window.KG && window.KG.ready) start();
  else document.addEventListener('kg:ready', start);
})();
