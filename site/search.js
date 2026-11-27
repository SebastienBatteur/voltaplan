// Recherche du guide et de la FAQ (même langue) : tout se passe dans le navigateur, sans service extérieur.
// FAQ : les questions sont filtrées sur place (repliées par défaut) ; guide : une liste de sections trouvées.
// Chaque page cherche aussi dans l'autre (chargée à la première recherche, même dossier).
(function () {
  var lang = document.documentElement.lang || 'fr';
  var T = {
    fr: { ph: 'Chercher (ex. PDF, Trikker, hors ligne)…', label: 'Chercher dans le guide et la FAQ', guide: 'Dans le guide', faq: 'Dans la FAQ', none: 'Aucun résultat.', copied: 'Lien copié', toc: 'Sommaire' },
    nl: { ph: 'Zoeken (bv. pdf, Trikker, offline)…', label: 'Zoeken in de handleiding en de FAQ', guide: 'In de handleiding', faq: 'In de FAQ', none: 'Geen resultaten.', copied: 'Link gekopieerd', toc: 'Inhoud' },
    en: { ph: 'Search (e.g. PDF, Trikker, offline)…', label: 'Search the guide and the FAQ', guide: 'In the guide', faq: 'In the FAQ', none: 'No results.', copied: 'Link copied', toc: 'Contents' },
    de: { ph: 'Suchen (z. B. PDF, Trikker, offline)…', label: 'In Anleitung und FAQ suchen', guide: 'In der Anleitung', faq: 'In den FAQ', none: 'Keine Ergebnisse.', copied: 'Link kopiert', toc: 'Inhalt' },
  }[lang] || null;
  if (!T) return;

  var isFaq = !!document.querySelector('main.faq');
  var isGuide = !isFaq && !!document.querySelector('main.doc > article');
  if (!isFaq && !isGuide) return;

  var norm = function (s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  };
  var esc = function (s) {
    return s.replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var clean = function (s) {
    return s.replace(/\s+/g, ' ').trim();
  };

  // Entrées : { href, title, text } ; FAQ = une question, guide = une section (h2 jusqu'au h2 suivant)
  function faqEntries(doc, base) {
    return Array.prototype.map.call(doc.querySelectorAll('main.faq details[id]'), function (d) {
      var sum = d.querySelector('summary');
      var a = d.querySelector('.faq-a');
      var text = a ? a.cloneNode(true) : d;
      var l = text.querySelector && text.querySelector('.faq-link');
      if (l) l.remove();
      return { href: base + '#' + d.id, title: clean(sum ? sum.textContent : ''), text: clean(text.textContent), el: d };
    });
  }
  function guideEntries(doc, base) {
    var out = [];
    var cur = null;
    var art = doc.querySelector('main.doc > article');
    if (!art) return out;
    Array.prototype.forEach.call(art.children, function (n) {
      if (n.tagName === 'H2') {
        cur = { href: base + '#' + n.id, title: clean(n.textContent), text: '' };
        out.push(cur);
      } else if (cur) cur.text += ' ' + clean(n.textContent);
    });
    return out;
  }

  var local = isFaq ? faqEntries(document, '') : guideEntries(document, '');
  var other = null;
  var otherFile = isFaq ? 'guide.html' : 'faq.html';
  function loadOther() {
    if (other) return other;
    other = fetch(otherFile)
      .then(function (r) {
        return r.ok ? r.text() : '';
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        return isFaq ? guideEntries(doc, otherFile) : faqEntries(doc, otherFile);
      })
      .catch(function () {
        return [];
      });
    return other;
  }

  // Tous les mots de la recherche doivent apparaître ; le titre compte plus que le texte
  function match(list, words) {
    return list
      .map(function (e) {
        var t = norm(e.title);
        var x = norm(e.text);
        var score = 0;
        for (var i = 0; i < words.length; i++) {
          var inT = t.indexOf(words[i]) >= 0;
          var inX = x.indexOf(words[i]) >= 0;
          if (!inT && !inX) return null;
          score += inT ? 3 : 1;
        }
        return { e: e, score: score };
      })
      .filter(Boolean)
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .map(function (r) {
        return r.e;
      });
  }

  // Extrait autour du premier mot trouvé, mots surlignés
  function snippet(text, words) {
    var n = norm(text);
    var at = -1;
    for (var i = 0; i < words.length && at < 0; i++) at = n.indexOf(words[i]);
    var from = Math.max(0, at - 60);
    var s = text.slice(from, from + 180);
    // Lettres accentuées : même longueur une fois normalisées, les positions valent pour le texte d'origine
    var ns = norm(s);
    var mark = new Array(s.length).fill(false);
    words.forEach(function (w) {
      for (var k = ns.indexOf(w); k >= 0; k = ns.indexOf(w, k + w.length)) for (var j = k; j < k + w.length; j++) mark[j] = true;
    });
    var out = '';
    for (var p = 0; p < s.length; ) {
      var q = p;
      while (q < s.length && mark[q] === mark[p]) q++;
      out += mark[p] ? '<mark>' + esc(s.slice(p, q)) + '</mark>' : esc(s.slice(p, q));
      p = q;
    }
    return (from > 0 ? '… ' : '') + out + (from + 180 < text.length ? ' …' : '');
  }

  function list(title, items, words) {
    if (!items.length) return '';
    return (
      '<h3>' + esc(title) + '</h3><ul>' +
      items
        .slice(0, 8)
        .map(function (e) {
          return '<li><a href="' + esc(e.href) + '">' + esc(e.title) + '</a><span>' + snippet(e.text, words) + '</span></li>';
        })
        .join('') +
      '</ul>'
    );
  }

  // Interface : champ de recherche et bloc de résultats
  var box = document.createElement('div');
  box.className = 'site-search';
  box.innerHTML = '<input type="search" placeholder="' + esc(T.ph) + '" aria-label="' + esc(T.label) + '" autocomplete="off">';
  var input = box.querySelector('input');
  var results = document.createElement('div');
  results.className = 'search-results';
  results.setAttribute('aria-live', 'polite');
  results.hidden = true;

  if (isFaq) {
    var holder = document.querySelector('.faq-search');
    holder.hidden = false;
    holder.replaceChild(box, holder.querySelector('input'));
    document.querySelector('.faq-empty').insertAdjacentElement('afterend', results);
  } else {
    var art = document.querySelector('main.doc > article');
    var toc = document.querySelector('main.doc > nav.toc');
    if (toc) {
      // Sommaire repliable (fermé sur petit écran : la recherche et ses résultats restent visibles)
      var tocList = document.createElement('details');
      tocList.className = 'toc-list';
      tocList.innerHTML = '<summary>' + esc(T.toc) + '</summary>';
      while (toc.firstChild) tocList.appendChild(toc.firstChild);
      tocList.open = !window.matchMedia('(max-width: 760px)').matches;
      toc.appendChild(box);
      toc.appendChild(tocList);
      tocList.addEventListener('click', function (e) {
        if (e.target.tagName === 'A' && window.matchMedia('(max-width: 760px)').matches) tocList.open = false;
      });
    } else art.insertBefore(box, art.firstChild);
    art.insertBefore(results, art.firstChild);
  }

  var timer = null;
  function run() {
    var q = input.value.trim();
    var words = norm(q).split(/\s+/).filter(Boolean);
    if (isFaq) filterFaq(words);
    if (!words.length) {
      results.hidden = true;
      results.innerHTML = '';
      return;
    }
    var mine = match(local, words);
    loadOther().then(function (o) {
      if (input.value.trim() !== q) return;
      var theirs = match(o, words);
      var html = isFaq
        ? list(T.guide, theirs, words)
        : list(T.guide, mine, words) + list(T.faq, theirs, words);
      if (!isFaq && !mine.length && !theirs.length) html = '<p class="muted">' + esc(T.none) + '</p>';
      results.innerHTML = html;
      results.hidden = !html;
    });
  }
  input.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(run, 120);
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      input.value = '';
      run();
    }
  });
  // « / » : aller à la recherche
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== input && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
      e.preventDefault();
      input.focus();
    }
  });

  // FAQ : filtrer les questions sur place
  var opened = null;
  function filterFaq(words) {
    var searching = words.length > 0;
    document.querySelector('main.faq').classList.toggle('searching', searching);
    if (searching && !opened) opened = local.filter(function (e) { return e.el.open; });
    var hits = searching ? match(local, words) : local;
    var set = new Set(hits);
    local.forEach(function (e) {
      e.el.hidden = searching && !set.has(e);
      // Peu de réponses trouvées : ouvertes directement ; sinon la liste des questions reste courte
      if (searching) e.el.open = set.has(e) && hits.length <= 3;
    });
    if (!searching && opened) {
      local.forEach(function (e) {
        e.el.open = opened.indexOf(e) >= 0;
      });
      opened = null;
    }
    document.querySelectorAll('.faq-group').forEach(function (g) {
      g.hidden = searching && !g.querySelector('details:not([hidden])');
    });
    document.querySelector('.faq-empty').hidden = !searching || hits.length > 0;
  }

  if (isFaq) {
    // Lien vers une question : la question s'ouvre
    var openHash = function () {
      var id = decodeURIComponent(location.hash.slice(1));
      var d = id && document.getElementById(id);
      if (d && d.tagName === 'DETAILS') {
        d.open = true;
        d.scrollIntoView();
      }
    };
    window.addEventListener('hashchange', openHash);
    openHash();
    // Liens internes vers une autre question (dans une réponse) : même chose
    document.querySelectorAll('main.faq a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function () {
        setTimeout(openHash, 0);
      });
    });
    // « Lien vers cette question » : copié dans le presse-papiers
    document.querySelectorAll('.faq-link a').forEach(function (a) {
      a.addEventListener('click', function () {
        var url = location.href.replace(/#.*$/, '') + a.getAttribute('href');
        if (navigator.clipboard) {
          navigator.clipboard.writeText(url).then(function () {
            var old = a.textContent;
            a.textContent = a.getAttribute('data-copied') || T.copied;
            setTimeout(function () {
              a.textContent = old;
            }, 1500);
          }, function () {});
        }
      });
    });
    // Tout ouvrir / tout fermer
    var toggle = document.querySelector('.faq-toggle');
    if (toggle)
      toggle.addEventListener('click', function () {
        var anyClosed = local.some(function (e) { return !e.el.hidden && !e.el.open; });
        local.forEach(function (e) {
          if (!e.el.hidden) e.el.open = anyClosed;
        });
        toggle.textContent = anyClosed ? toggle.getAttribute('data-close') : toggle.getAttribute('data-open');
      });
  }

  // Recherche transmise dans l'adresse (?q=…)
  var q0 = new URLSearchParams(location.search).get('q');
  if (q0) {
    input.value = q0;
    run();
  }
})();
