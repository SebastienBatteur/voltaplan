// Liens vers le dépôt et les installateurs, déduits de l'adresse GitHub Pages (<compte>.github.io/<dépôt>/).
(function () {
  var m = location.hostname.match(/^([^.]+)\.github\.io$/);
  var repoName = location.pathname.split('/').filter(Boolean)[0];
  var repo = m && repoName ? 'https://github.com/' + m[1] + '/' + repoName : 'https://github.com/';
  document.querySelectorAll('.repo-link').forEach(function (a) {
    a.href = repo;
  });
  document.querySelectorAll('.release-link').forEach(function (a) {
    a.href = repo + (m ? '/releases/latest' : '');
  });
  document.querySelectorAll('.app-url').forEach(function (el) {
    el.textContent = new URL('app/', location.href).href;
  });
})();
