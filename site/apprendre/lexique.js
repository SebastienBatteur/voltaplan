// Lexique : filtre des mots dans la page (accents ignorés) et mot ciblé par l'adresse (#mot) mis en évidence.
(function () {
  var tools = document.querySelector('.lex-tools');
  var input = document.querySelector('.lex-filter');
  if (!tools || !input) return;
  tools.hidden = false;
  var norm = function (s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  };
  var items = Array.prototype.map.call(document.querySelectorAll('.lex'), function (el) {
    return { el: el, term: norm(el.querySelector('dt').textContent), text: norm(el.textContent) };
  });
  var groups = document.querySelectorAll('.lex-group');
  var empty = document.querySelector('.lex-empty');
  input.addEventListener('input', function () {
    var words = norm(input.value.trim()).split(/\s+/).filter(Boolean);
    var n = 0;
    items.forEach(function (it) {
      var hit = words.every(function (w) { return it.text.indexOf(w) >= 0; });
      it.el.hidden = !hit;
      if (hit) n++;
    });
    groups.forEach(function (g) {
      g.hidden = !g.querySelector('.lex:not([hidden])');
    });
    empty.hidden = n > 0;
  });
  var mark = function () {
    document.querySelectorAll('.lex.target').forEach(function (e) { e.classList.remove('target'); });
    var id = decodeURIComponent(location.hash.slice(1));
    var el = id && document.getElementById(id);
    if (el && el.classList.contains('lex')) el.classList.add('target');
  };
  window.addEventListener('hashchange', mark);
  mark();
})();
