/* Minimal, dependency-free client script. Loaded with `defer`. */
(function () {
  'use strict';

  var cfg = window.SITE_CONFIG || {};
  var doc = document;
  var root = doc.documentElement;

  /* ---------------------------------------------------------------------- */
  /* Dark mode toggle (persisted in localStorage)                           */
  /* ---------------------------------------------------------------------- */
  var themeBtn = doc.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var dark = root.classList.toggle('dark');
      try {
        localStorage.setItem('theme', dark ? 'dark' : 'light');
      } catch (e) {}
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Hamburger menu                                                         */
  /* ---------------------------------------------------------------------- */
  var menuBtn = doc.getElementById('menu-toggle');
  var menu = doc.getElementById('mobile-menu');
  var searchBtn = doc.getElementById('search-toggle');
  var searchPanel = doc.getElementById('search-panel');
  var searchInput = doc.getElementById('search-input');

  function setOpen(btn, panel, open) {
    if (!btn || !panel) return;
    panel.classList.toggle('hidden', !open);
    btn.setAttribute('aria-expanded', String(open));
  }

  if (menuBtn && menu) {
    menuBtn.addEventListener('click', function () {
      var open = menu.classList.contains('hidden');
      setOpen(menuBtn, menu, open);
      if (open) setOpen(searchBtn, searchPanel, false);
    });
  }

  if (searchBtn && searchPanel) {
    searchBtn.addEventListener('click', function () {
      var open = searchPanel.classList.contains('hidden');
      setOpen(searchBtn, searchPanel, open);
      if (open) {
        setOpen(menuBtn, menu, false);
        if (searchInput) searchInput.focus();
      }
    });
  }

  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      setOpen(menuBtn, menu, false);
      setOpen(searchBtn, searchPanel, false);
    }
  });

  /* ---------------------------------------------------------------------- */
  /* Reading progress bar (article pages only)                              */
  /* ---------------------------------------------------------------------- */
  var progress = doc.getElementById('reading-progress');
  var article = doc.querySelector('[data-article]');
  if (progress && article) {
    var ticking = false;
    var update = function () {
      var rect = article.getBoundingClientRect();
      var start = rect.top + window.scrollY;
      var total = article.offsetHeight - window.innerHeight;
      var pct = total > 0 ? Math.min(1, Math.max(0, (window.scrollY - start) / total)) : 1;
      progress.style.transform = 'scaleX(' + pct + ')';
      ticking = false;
    };
    window.addEventListener(
      'scroll',
      function () {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
    update();
  } else if (progress) {
    progress.style.display = 'none';
  }

  /* ---------------------------------------------------------------------- */
  /* Client-side search with debounce                                       */
  /* ---------------------------------------------------------------------- */
  var results = doc.getElementById('search-results');
  var index = null;
  var loading = null;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function loadIndex() {
    if (index) return Promise.resolve(index);
    if (!loading) {
      loading = fetch((cfg.basePath || '') + '/search.json')
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          index = data;
          return data;
        })
        .catch(function () {
          index = [];
          return index;
        });
    }
    return loading;
  }

  function score(item, terms) {
    var title = item.t.toLowerCase();
    var desc = item.d.toLowerCase();
    var cat = item.c.toLowerCase();
    var keys = (item.k || '').toLowerCase();
    var total = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      var s = 0;
      if (title.indexOf(t) !== -1) s += 10;
      if (keys.indexOf(t) !== -1) s += 5;
      if (cat.indexOf(t) !== -1) s += 4;
      if (desc.indexOf(t) !== -1) s += 2;
      if (!s) return 0; // every term must match somewhere
      total += s;
    }
    return total;
  }

  function renderResults(items, q) {
    if (!results) return;
    if (!q) {
      results.innerHTML = '';
      return;
    }
    if (!items.length) {
      results.innerHTML = '<p class="py-4 text-sm text-neutral-500">No results for “' + escapeHtml(q) + '”.</p>';
      return;
    }
    results.innerHTML =
      '<ul class="divide-y divide-neutral-200 dark:divide-neutral-800">' +
      items
        .map(function (it) {
          return (
            '<li role="option"><a href="' +
            escapeHtml(it.u) +
            '" class="flex gap-3 py-3 hover:text-brand-600">' +
            '<img src="' +
            escapeHtml(it.i) +
            '" alt="" width="96" height="54" loading="lazy" class="h-[54px] w-24 flex-none rounded object-cover">' +
            '<span class="min-w-0"><span class="kicker">' +
            escapeHtml(it.c) +
            '</span><span class="block text-sm font-semibold leading-snug">' +
            escapeHtml(it.t) +
            '</span><span class="block text-xs text-neutral-500">' +
            escapeHtml(it.dt) +
            '</span></span></a></li>'
          );
        })
        .join('') +
      '</ul>';
  }

  function runSearch(q) {
    var query = q.trim().toLowerCase();
    if (query.length < 2) {
      renderResults([], '');
      return;
    }
    loadIndex().then(function (data) {
      var terms = query.split(/\s+/).filter(Boolean);
      var matched = data
        .map(function (it) {
          return { it: it, s: score(it, terms) };
        })
        .filter(function (r) {
          return r.s > 0;
        })
        .sort(function (a, b) {
          return b.s - a.s || (a.it.dt < b.it.dt ? 1 : -1);
        })
        .slice(0, 10)
        .map(function (r) {
          return r.it;
        });
      renderResults(matched, q.trim());
    });
  }

  function debounce(fn, wait) {
    var timer;
    return function () {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(null, args);
      }, wait);
    };
  }

  if (searchInput) {
    searchInput.addEventListener('input', debounce(function (e) {
      runSearch(e.target.value);
    }, 200));
    // Warm the index on first focus so the first keystroke feels instant.
    searchInput.addEventListener('focus', loadIndex, { once: true });

    // Support /?q=term deep links (used by the WebSite SearchAction schema).
    var params = new URLSearchParams(window.location.search);
    var q = params.get('q');
    if (q) {
      setOpen(searchBtn, searchPanel, true);
      searchInput.value = q;
      runSearch(q);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Sticky anchor ad                                                       */
  /* ---------------------------------------------------------------------- */
  var anchor = doc.getElementById('anchor-ad');
  var anchorClose = doc.getElementById('anchor-ad-close');
  if (anchor && anchorClose) {
    anchorClose.addEventListener('click', function () {
      anchor.remove();
      doc.body.classList.remove('has-anchor-ad');
    });
  }

  /* ---------------------------------------------------------------------- */
  /* AdSense: load the library lazily, only when a publisher ID is set      */
  /* ---------------------------------------------------------------------- */
  function loadAdsense() {
    if (!cfg.adsenseClient) return;
    var units = doc.querySelectorAll('ins.adsbygoogle');
    if (!units.length) return;

    var s = doc.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(cfg.adsenseClient);
    s.onload = function () {
      window.adsbygoogle = window.adsbygoogle || [];
      for (var i = 0; i < units.length; i++) {
        try {
          window.adsbygoogle.push({});
        } catch (e) {}
      }
    };
    doc.head.appendChild(s);
  }

  // Defer third-party script until the browser is idle to protect Core Web Vitals.
  if ('requestIdleCallback' in window) {
    requestIdleCallback(loadAdsense, { timeout: 3000 });
  } else {
    setTimeout(loadAdsense, 1500);
  }
})();
