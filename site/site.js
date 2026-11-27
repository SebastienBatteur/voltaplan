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

  // Accueil en français, première visite : proposer directement la langue du navigateur (nl / en / de)
  if (lang === 'fr' && location.href.replace(/index\.html$/, '') === root && !store()) {
    var nav = (navigator.language || 'fr').slice(0, 2);
    if (nav === 'nl' || nav === 'en' || nav === 'de') {
      location.replace(root + nav + '/');
      return;
    }
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
