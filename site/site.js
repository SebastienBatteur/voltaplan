// Liens vers le dépôt : déduits de l'adresse GitHub Pages (<compte>.github.io/<dépôt>/) si le site y est servi,
// sinon (domaine propre, ex. voltaplan.org) le dépôt officiel.
// Pages en néerlandais, en anglais et en allemand dans nl/, en/ et de/ ; ce script est toujours à la racine du site.
(function () {
  var root = new URL('./', document.currentScript.src).href;
  var lang = document.documentElement.lang || 'fr';
  var m = location.hostname.match(/^([^.]+)\.github\.io$/);
  var repoName = location.pathname.split('/').filter(Boolean)[0];
  var repo = m && repoName ? 'https://github.com/' + m[1] + '/' + repoName : 'https://github.com/SebastienBatteur/voltaplan';
  var KEY = 'voltaplan-site-lang';
  var store = function (v) {
    try {
      if (v === undefined) return localStorage.getItem(KEY);
      localStorage.setItem(KEY, v);
    } catch (e) {
      return null;
    }
  };

  // Première visite dans une autre langue que celle du navigateur : un bandeau propose la bonne version.
  // Jamais de redirection automatique : les moteurs de recherche (sans langue ni mémoire) voient chaque page telle quelle.
  var OFFER = {
    fr: ['Cette page existe en français.', 'Lire en français', 'Fermer'],
    nl: ['Deze pagina bestaat in het Nederlands.', 'Lezen in het Nederlands', 'Sluiten'],
    en: ['This page is available in English.', 'Read in English', 'Close'],
    de: ['Diese Seite gibt es auf Deutsch.', 'Auf Deutsch lesen', 'Schließen'],
  };
  var want = (navigator.language || '').slice(0, 2);
  var alt = want !== lang && OFFER[want] && !store() && document.querySelector('.lang-menu a[data-lang="' + want + '"]');
  if (alt) {
    var o = OFFER[want];
    var bar = document.createElement('div');
    bar.className = 'lang-offer';
    bar.lang = want;
    bar.innerHTML = '<span></span> <a></a><button type="button">×</button>';
    bar.querySelector('span').textContent = o[0];
    var go = bar.querySelector('a');
    go.textContent = o[1];
    go.href = alt.getAttribute('href') + location.hash;
    go.hreflang = want;
    go.addEventListener('click', function () {
      store(want);
    });
    var x = bar.querySelector('button');
    x.setAttribute('aria-label', o[2]);
    x.addEventListener('click', function () {
      store(lang);
      bar.remove();
    });
    document.body.insertBefore(bar, document.body.firstChild);
  }

  document.querySelectorAll('.lang a').forEach(function (a) {
    a.addEventListener('click', function () {
      store(a.getAttribute('data-lang'));
    });
  });
  // Menu des langues : fermé par un clic ailleurs ou Échap
  var langMenu = document.querySelector('details.lang');
  if (langMenu) {
    document.addEventListener('click', function (e) {
      if (langMenu.open && !langMenu.contains(e.target)) langMenu.open = false;
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && langMenu.open) {
        langMenu.open = false;
        langMenu.querySelector('summary').focus();
      }
    });
  }
  document.querySelectorAll('.repo-link').forEach(function (a) {
    a.href = repo;
  });
  // Aucune version de bureau publiée pour l'instant : les liens « release » mènent à la page des versions du dépôt
  document.querySelectorAll('.release-link').forEach(function (a) {
    a.href = repo + '/releases';
  });
  // L'application s'ouvre dans la langue de la page
  document.querySelectorAll('a[href$="app/"]').forEach(function (a) {
    a.href = root + 'app/?lang=' + lang;
  });
  document.querySelectorAll('.app-url').forEach(function (el) {
    el.textContent = root + 'app/';
  });
})();
