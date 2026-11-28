// Exercices de câblage interactifs (pages « Apprendre ») : relier les bornes avec des fils de couleur, essayer les
// commandes (la lampe s'allume, le volet monte…), puis « Vérifier ». Tout se passe dans le navigateur.
// Définition de chaque exercice : <script type="application/json"> dans <div class="exo"> (voir tools/learn).
(function () {
  var Sim = window.CablageSim;
  if (!Sim) return;
  var NS = 'http://www.w3.org/2000/svg';
  var lang = document.documentElement.lang || 'fr';
  var T = {
    fr: {
      colors: { brown: 'Brun (phase)', black: 'Noir', grey: 'Gris', blue: 'Bleu (neutre)', gy: 'Vert-jaune (terre)' },
      wire: 'Couleur du fil',
      check: 'Vérifier',
      undo: 'Annuler le dernier fil',
      clear: 'Tout effacer',
      solution: 'Voir une solution',
      reset: 'Réarmer',
      help: 'Touchez une borne puis une autre pour poser un fil. Touchez un fil pour le retirer. Touchez un interrupteur pour le manœuvrer.',
      tripped: 'Le disjoncteur a déclenché.',
      ok: 'Bravo : le montage fonctionne et respecte les règles vérifiées par cet exercice. Ce n’est pas un contrôle de conformité.',
      okWarn: 'Le montage fonctionne, avec une remarque :',
      empty: 'Aucun fil posé pour l’instant.',
      msg: {
        short: 'Court-circuit : la phase touche directement le neutre. Le disjoncteur déclenche.',
        earthFault: 'Défaut à la terre : la phase est reliée à la terre. Le différentiel déclenche.',
        neutralEarth: 'Le neutre est relié à la terre : le différentiel déclencherait.',
        bothDirections: '{dev} reçoit montée et descente en même temps : le moteur peut être endommagé.',
        switchOnNeutral: '{dev} est sur le neutre : interdit (RGIE 5.3.3.2 c). Un interrupteur coupe la phase, sinon l’appareil éteint reste sous tension.',
        noEarth: '{dev} n’est pas relié à la terre (borne PE).',
        peColor: 'Le conducteur de protection (la terre) est isolé en vert-jaune (RGIE 5.4.3.3).',
        gyMisuse: 'Le vert-jaune est réservé à la terre : interdit sur un conducteur actif (RGIE 5.1.6.2).',
        neutralColor: 'Bonne pratique : câblez le neutre en bleu, pour qu’on le reconnaisse.',
        blueMisuse: 'Le bleu est réservé au neutre dans un circuit qui en comporte (RGIE 5.1.6.2) : prenez une autre couleur pour la phase et les retours.',
        behaviour: 'Le montage ne fonctionne pas comme demandé : manœuvrez les commandes pour voir ce qui se passe.',
      },
      state: { on: 'allumée', off: 'éteinte', up: 'monte', down: 'descend', stop: 'à l’arrêt', motion: 'mouvement détecté', idle: 'rien ne bouge' },
    },
  }[lang] || null;
  if (!T) return;

  var W = 34; // écart entre bornes
  var BOX_H = 80;
  var el = function (name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  var TERM_LABEL = { up: '▲', down: '▼', out: '→' };

  function setup(holder) {
    var ex = JSON.parse(holder.querySelector('script[type="application/json"]').textContent);
    var byId = {};
    ex.devices.forEach(function (d) { byId[d.id] = d; });
    var wires = [];
    var state = Sim.initialState(ex);
    var held = null; // bouton maintenu enfoncé
    var tripped = false;
    var selected = null;
    var color = 'brown';

    // Géométrie : boîte de chaque appareil et position de ses bornes
    var geo = {};
    ex.devices.forEach(function (d) {
      var terms = Sim.TYPES[d.type].terms;
      var w = Math.max(96, terms.length * W + 16);
      var side = d.side || 'bottom';
      var g = { x: d.x, y: d.y, w: w, h: BOX_H, side: side, t: {} };
      terms.forEach(function (t, i) {
        var off = (w - (terms.length - 1) * W) / 2 + i * W;
        g.t[t] = side === 'top' ? { x: d.x + off, y: d.y - 8 } : { x: d.x + off, y: d.y + BOX_H + 8 };
      });
      geo[d.id] = g;
    });
    var pos = function (k) {
      var p = k.split('.');
      return geo[p[0]].t[p[1]];
    };
    var nameOf = function (id) { return byId[id] ? byId[id].label : id; };

    // Interface
    holder.innerHTML = '';
    holder.classList.add('ready');
    var help = document.createElement('p');
    help.className = 'exo-help';
    help.textContent = T.help;
    holder.appendChild(help);
    var bar = document.createElement('div');
    bar.className = 'exo-bar';
    var pal = document.createElement('div');
    pal.className = 'exo-colors';
    pal.setAttribute('role', 'radiogroup');
    pal.setAttribute('aria-label', T.wire);
    Sim.COLORS.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sw c-' + c;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', T.colors[c]);
      b.title = T.colors[c];
      b.addEventListener('click', function () {
        color = c;
        sync();
      });
      pal.appendChild(b);
    });
    bar.appendChild(pal);
    var btn = function (label, cls, fn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ' + (cls || '');
      b.textContent = label;
      b.addEventListener('click', fn);
      bar.appendChild(b);
      return b;
    };
    btn(T.check, 'primary', verify);
    btn(T.undo, '', function () {
      wires.pop();
      changed();
    });
    btn(T.clear, '', function () {
      wires = [];
      changed();
    });
    btn(T.solution, '', function () {
      wires = ex.solution.map(function (w) { return { a: w.a, b: w.b, color: w.color }; });
      changed();
    });
    holder.appendChild(bar);

    var maxX = 0;
    var maxY = 0;
    ex.devices.forEach(function (d) {
      maxX = Math.max(maxX, geo[d.id].x + geo[d.id].w);
      maxY = Math.max(maxY, geo[d.id].y + BOX_H);
    });
    var vw = ex.w || maxX + 20;
    var vh = ex.h || maxY + 40;
    var svg = el('svg', { viewBox: '0 0 ' + vw + ' ' + vh, class: 'exo-svg', role: 'group', 'aria-label': ex.title || '' });
    // Sur téléphone, le dessin garde une taille où l'on peut toucher les bornes : il défile horizontalement
    var scroller = document.createElement('div');
    scroller.className = 'exo-canvas';
    svg.style.minWidth = Math.round(vw * 0.85) + 'px';
    scroller.appendChild(svg);
    holder.appendChild(scroller);
    var gWires = el('g', { class: 'wires' }, svg);
    var gDev = el('g', { class: 'devs' }, svg);
    var live = document.createElement('div');
    live.className = 'exo-live';
    live.setAttribute('aria-live', 'polite');
    holder.appendChild(live);
    var out = document.createElement('div');
    out.className = 'exo-result';
    out.setAttribute('aria-live', 'polite');
    holder.appendChild(out);

    // Appareils
    var parts = {};
    ex.devices.forEach(function (d) {
      var g = geo[d.id];
      var T0 = Sim.TYPES[d.type];
      var grp = el('g', { class: 'dev t-' + d.type }, gDev);
      var body = el('g', { class: 'body' }, grp);
      el('rect', { x: g.x, y: g.y, width: g.w, height: g.h, rx: 8 }, body);
      var lbl = el('text', { x: g.x + g.w / 2, y: g.side === 'top' ? g.y + g.h - 10 : g.y + 16, 'text-anchor': 'middle', class: 'lbl' }, body);
      lbl.textContent = d.label;
      var icon = el('g', { class: 'icon', transform: 'translate(' + (g.x + g.w / 2) + ',' + (g.side === 'top' ? g.y + 42 : g.y + 40) + ')' }, body);
      parts[d.id] = { grp: grp, icon: icon };
      // Commandes manœuvrables
      if (T0.states) {
        body.setAttribute('tabindex', '0');
        body.setAttribute('role', 'button');
        body.classList.add('ctl');
        if (T0.momentary) {
          var down = function (e) {
            e.preventDefault();
            if (held) return;
            var r = Sim.press(ex, wires, state, d.id);
            held = d.id;
            state = r.held;
            render();
            var upFn = function () {
              document.removeEventListener('pointerup', upFn);
              state = r.after;
              held = null;
              render();
            };
            document.addEventListener('pointerup', upFn);
          };
          body.addEventListener('pointerdown', down);
          body.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            state = Sim.press(ex, wires, state, d.id).after;
            render();
          });
        } else {
          var cycle = function () {
            var i = T0.states.indexOf(state[d.id]);
            if (d.type === 'double') {
              // Deux touches : un clic sur la moitié gauche ou droite
              return;
            }
            state[d.id] = T0.states[(i + 1) % T0.states.length];
            render();
          };
          body.addEventListener('click', function (e) {
            if (d.type === 'double') {
              var pt = svgPoint(e);
              var s = state[d.id].split('');
              var k = pt.x < g.x + g.w / 2 ? 0 : 1;
              s[k] = s[k] === '1' ? '0' : '1';
              state[d.id] = s.join('');
              render();
            } else cycle();
          });
          body.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            if (d.type === 'double') {
              var s = state[d.id];
              state[d.id] = T0.states[(T0.states.indexOf(s) + 1) % 4];
              render();
            } else cycle();
          });
        }
      }
      // Bornes
      T0.terms.forEach(function (t) {
        var p = g.t[t];
        var k = Sim.key(d.id, t);
        var tg = el('g', { class: 'term', tabindex: '0', role: 'button', 'aria-label': d.label + ' ' + t, 'data-k': k }, grp);
        el('line', { x1: p.x, y1: g.side === 'top' ? g.y : g.y + g.h, x2: p.x, y2: p.y }, tg);
        el('circle', { cx: p.x, cy: p.y, r: 7 }, tg);
        el('circle', { cx: p.x, cy: p.y, r: 16, class: 'hit' }, tg);
        var tl = el('text', { x: p.x, y: g.side === 'top' ? g.y + 12 : g.y + g.h - 5, 'text-anchor': 'middle', class: 'tl' }, tg);
        tl.textContent = TERM_LABEL[t] || t;
        var pick = function () {
          if (selected === k) selected = null;
          else if (!selected) selected = k;
          else {
            var a = selected;
            selected = null;
            var dup = wires.some(function (w) { return (w.a === a && w.b === k) || (w.a === k && w.b === a); });
            if (!dup && a.split('.')[0] + a.split('.')[1] !== k.split('.')[0] + k.split('.')[1]) wires.push({ a: a, b: k, color: color });
            changed();
            return;
          }
          render();
        };
        tg.addEventListener('click', pick);
        tg.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            pick();
          }
        });
      });
    });

    function svgPoint(e) {
      var r = svg.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * vw, y: ((e.clientY - r.top) / r.height) * vh };
    }

    function wirePath(w, i) {
      var a = pos(w.a);
      var b = pos(w.b);
      var da = geo[w.a.split('.')[0]].side === 'top' ? -1 : 1;
      var db = geo[w.b.split('.')[0]].side === 'top' ? -1 : 1;
      var sag = 40 + (i % 4) * 10;
      return 'M' + a.x + ' ' + a.y + ' C' + a.x + ' ' + (a.y + da * sag) + ' ' + b.x + ' ' + (b.y + db * sag) + ' ' + b.x + ' ' + b.y;
    }

    function changed() {
      tripped = false;
      out.innerHTML = '';
      render();
    }

    function sync() {
      Array.prototype.forEach.call(pal.children, function (b, i) {
        b.setAttribute('aria-checked', Sim.COLORS[i] === color ? 'true' : 'false');
      });
    }

    function icon(d, res) {
      var g = parts[d.id].icon;
      g.innerHTML = '';
      var s = state[d.id];
      var on = res && res.on[d.id];
      switch (d.type) {
        case 'lamp':
          el('circle', { r: 11, class: on ? 'lit' : '' }, g);
          el('path', { d: 'M-7.8 -7.8L7.8 7.8M-7.8 7.8L7.8 -7.8' }, g);
          break;
        case 'socket':
          el('path', { d: 'M-12 4a12 12 0 0 1 24 0', class: on ? 'lit-stroke' : '' }, g);
          el('line', { x1: -12, y1: 4, x2: 12, y2: 4 }, g);
          break;
        case 'switch':
        case 'push':
          el('circle', { cx: -14, cy: 6, r: 2.5 }, g);
          el('circle', { cx: 14, cy: 6, r: 2.5 }, g);
          el('line', { x1: -14, y1: 6, x2: 14, y2: s === 'on' || s === 'down' ? 6 : -6 }, g);
          if (d.type === 'push') el('line', { x1: 0, y1: -14, x2: 0, y2: s === 'down' ? 4 : -4, class: 'thin' }, g);
          break;
        case 'double':
          [-16, 16].forEach(function (x, i) {
            el('circle', { cx: x - 8, cy: 6, r: 2 }, g);
            el('line', { x1: x - 8, y1: 6, x2: x + 8, y2: s[i] === '1' ? 6 : -5 }, g);
          });
          break;
        case 'twoway':
          el('circle', { cx: -14, cy: 2, r: 2.5 }, g);
          el('line', { x1: -14, y1: 2, x2: 14, y2: s === '1' ? -6 : 10 }, g);
          el('circle', { cx: 14, cy: -6, r: 2 }, g);
          el('circle', { cx: 14, cy: 10, r: 2 }, g);
          break;
        case 'intermediate':
          el('path', { d: s === '=' ? 'M-14 -6H14M-14 10H14' : 'M-14 -6L14 10M-14 10L14 -6' }, g);
          break;
        case 'shutterSwitch':
          var t = el('text', { y: 6, 'text-anchor': 'middle', class: 'big' }, g);
          t.textContent = s === 'up' ? '▲' : s === 'down' ? '▼' : '■';
          break;
        case 'relay':
          el('rect', { x: -22, y: -8, width: 14, height: 16, class: res && res.coil[d.id] ? 'lit' : '' }, g);
          el('circle', { cx: 2, cy: 4, r: 2 }, g);
          el('line', { x1: 2, y1: 4, x2: 22, y2: s === 'on' ? 4 : -6 }, g);
          break;
        case 'detector':
          el('path', { d: 'M-10 8a10 10 0 0 1 20 0Z', class: s === 'motion' ? 'lit' : '' }, g);
          if (s === 'motion') el('path', { d: 'M-16 -4q16 -14 32 0', class: 'thin' }, g);
          break;
        case 'motor':
          el('circle', { r: 12 }, g);
          var m = el('text', { y: 4, 'text-anchor': 'middle' }, g);
          m.textContent = on && on.up && !on.down ? '▲' : on && on.down && !on.up ? '▼' : 'M';
          if (on && (on.up || on.down)) g.firstChild.setAttribute('class', 'lit');
          break;
        case 'supply':
          var z = el('text', { y: 4, 'text-anchor': 'middle', class: 'small' }, g);
          z.textContent = tripped ? '⚠' : '230 V';
          break;
      }
    }

    function render() {
      sync();
      var res = tripped ? null : Sim.evaluate(ex, wires, state);
      if (res && res.faults.some(function (f) { return f.code === 'short' || f.code === 'earthFault'; })) {
        tripped = res.faults[0].code;
        res = null;
      }
      gWires.innerHTML = '';
      wires.forEach(function (w, i) {
        var d = wirePath(w, i);
        var p = el('path', { d: d, class: 'wire c-' + w.color, tabindex: '0', role: 'button', 'aria-label': nameOf(w.a.split('.')[0]) + ' ' + w.a.split('.')[1] + ' – ' + nameOf(w.b.split('.')[0]) + ' ' + w.b.split('.')[1] }, gWires);
        if (w.color === 'gy') el('path', { d: d, class: 'wire gy-stripe' }, gWires);
        var rm = function () {
          wires.splice(i, 1);
          changed();
        };
        p.addEventListener('click', rm);
        p.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === 'Delete' || e.key === 'Backspace') rm();
        });
      });
      Array.prototype.forEach.call(svg.querySelectorAll('.term'), function (t) {
        t.classList.toggle('sel', t.getAttribute('data-k') === selected);
      });
      ex.devices.forEach(function (d) { icon(d, res); });
      // Résumé lisible de l'état (aussi pour les lecteurs d'écran)
      live.innerHTML = '';
      if (tripped) {
        var p = document.createElement('p');
        p.className = 'bad';
        p.textContent = T.msg[tripped] + ' ';
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn';
        b.textContent = T.reset;
        b.addEventListener('click', changed);
        p.appendChild(b);
        live.appendChild(p);
        return;
      }
      var bits = [];
      ex.devices.forEach(function (d) {
        var o = res.on[d.id];
        if (d.type === 'lamp') bits.push(d.label + ' : ' + (o ? T.state.on : T.state.off));
        if (d.type === 'motor') bits.push(d.label + ' : ' + (o.up && !o.down ? T.state.up : o.down && !o.up ? T.state.down : T.state.stop));
      });
      if (bits.length) {
        var q = document.createElement('p');
        q.className = 'muted';
        q.textContent = bits.join(' · ');
        live.appendChild(q);
      }
    }

    // Le résultat est construit nœud par nœud (textContent) : les noms d'appareils viennent des données de la page
    // et ne sont jamais réinterprétés comme du HTML.
    function verify() {
      out.textContent = '';
      var add = function (parent, tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        parent.appendChild(n);
        return n;
      };
      if (!wires.length) {
        add(out, 'p', 'muted', T.empty);
        return;
      }
      var r = Sim.check(ex, wires);
      var fmt = function (m) { return T.msg[m.code].replace('{dev}', m.dev ? nameOf(m.dev) : ''); };
      if (r.ok) add(out, 'p', 'good', '✓ ' + (r.warnings.length ? T.okWarn : T.ok));
      if (!r.errors.length && !r.warnings.length) return;
      var ul = add(out, 'ul', '');
      r.errors.forEach(function (m) { add(ul, 'li', 'bad', fmt(m)); });
      r.warnings.forEach(function (m) { add(ul, 'li', 'warn', fmt(m)); });
    }

    render();
  }

  document.querySelectorAll('.exo').forEach(setup);
})();
