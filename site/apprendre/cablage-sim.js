// Simulateur de câblage des exercices « Apprendre » : fonction pure, sans interface, aussi utilisée par les tests.
// Un montage = des appareils (bornes) + des fils (borne ↔ borne, couleur). Les contacts des interrupteurs relient
// des bornes selon leur position ; les récepteurs (lampe, prise, moteur, bobine) ne relient rien : ils fonctionnent
// quand une de leurs bornes est sur la phase et l'autre sur le neutre.
(function (root) {
  // Bornes de chaque type d'appareil, et contacts fermés selon l'état
  var TYPES = {
    supply: { terms: ['L', 'N', 'PE'] },
    switch: { terms: ['L', '1'], states: ['off', 'on'], contacts: function (s) { return s === 'on' ? [['L', '1']] : []; } },
    double: {
      terms: ['L', '1', '2'],
      // Deux touches : état « ab » (0/1 pour chacune), ex. '10' = touche 1 enfoncée
      states: ['00', '10', '01', '11'],
      contacts: function (s) {
        var c = [];
        if (s[0] === '1') c.push(['L', '1']);
        if (s[1] === '1') c.push(['L', '2']);
        return c;
      },
    },
    twoway: { terms: ['C', '1', '2'], states: ['1', '2'], contacts: function (s) { return [['C', s]]; } },
    intermediate: {
      terms: ['1', '2', '3', '4'],
      states: ['=', 'x'],
      contacts: function (s) { return s === '=' ? [['1', '3'], ['2', '4']] : [['1', '4'], ['2', '3']]; },
    },
    push: { terms: ['1', '2'], states: ['up', 'down'], momentary: true, contacts: function (s) { return s === 'down' ? [['1', '2']] : []; } },
    shutterSwitch: {
      terms: ['L', 'up', 'down'],
      states: ['stop', 'up', 'down'],
      contacts: function (s) { return s === 'stop' ? [] : [['L', s]]; },
    },
    // Télérupteur : bobine A1-A2, contact 1-2 qui change d'état à chaque impulsion
    relay: { terms: ['A1', 'A2', '1', '2'], coil: ['A1', 'A2'], memory: true, contacts: function (s) { return s === 'on' ? [['1', '2']] : []; } },
    // Détecteur de mouvement : alimenté (L, N), sortie reliée à L quand il détecte
    detector: { terms: ['L', 'N', 'out'], states: ['idle', 'motion'], powered: ['L', 'N'], contacts: function (s) { return s === 'motion' ? [['L', 'out']] : []; } },
    lamp: { terms: ['L', 'N', 'PE'], load: ['L', 'N'] },
    socket: { terms: ['L', 'N', 'PE'], load: ['L', 'N'] },
    // Moteur de volet : deux enroulements (montée, descente) avec un neutre commun
    motor: { terms: ['up', 'down', 'N', 'PE'], loads: { up: ['up', 'N'], down: ['down', 'N'] } },
    // Boîte de dérivation : bornes de connexion (chaque borne relie les fils qui y arrivent)
    box: { terms: ['a', 'b', 'c', 'd', 'e', 'f'] },
  };
  var SWITCHING = { switch: 1, double: 1, twoway: 1, intermediate: 1, push: 1, shutterSwitch: 1 };
  var COLORS = ['brown', 'blue', 'gy', 'black', 'grey'];

  function key(dev, term) {
    return dev + '.' + term;
  }

  function byId(ex, id) {
    return ex.devices.filter(function (d) { return d.id === id; })[0];
  }

  function initialState(ex) {
    var s = {};
    ex.devices.forEach(function (d) {
      var T = TYPES[d.type];
      if (T.states) s[d.id] = T.states[0];
      if (T.memory) s[d.id] = 'off';
    });
    return s;
  }

  // Réseaux électriques (union-find des bornes reliées par des fils ou des contacts fermés)
  function nets(ex, wires, state) {
    var parent = {};
    var find = function (k) {
      if (!(k in parent)) parent[k] = k;
      while (parent[k] !== k) k = parent[k] = parent[parent[k]];
      return k;
    };
    var join = function (a, b) {
      parent[find(a)] = find(b);
    };
    ex.devices.forEach(function (d) {
      var T = TYPES[d.type];
      T.terms.forEach(function (t) { find(key(d.id, t)); });
      if (!T.contacts) return;
      // Un détecteur non alimenté ne commute pas
      if (T.powered && state._powered && !state._powered[d.id]) return;
      T.contacts(state[d.id]).forEach(function (c) { join(key(d.id, c[0]), key(d.id, c[1])); });
    });
    wires.forEach(function (w) { join(w.a, w.b); });
    return find;
  }

  // État électrique d'un montage pour un état des commandes : récepteurs en marche, défauts
  function evaluate(ex, wires, state) {
    var src = ex.devices.filter(function (d) { return d.type === 'supply'; })[0];
    var st = Object.assign({}, state);
    var find;
    // Deux passes : les détecteurs commutent seulement s'ils sont alimentés (alimentation via le câblage)
    st._powered = null;
    find = nets(ex, wires, st);
    var L = find(key(src.id, 'L'));
    var N = find(key(src.id, 'N'));
    var PE = find(key(src.id, 'PE'));
    var live = function (a, b, d) {
      var x = find(key(d, a));
      var y = find(key(d, b));
      return (x === L && y === N) || (x === N && y === L);
    };
    st._powered = {};
    ex.devices.forEach(function (d) {
      var T = TYPES[d.type];
      if (T.powered) st._powered[d.id] = live(T.powered[0], T.powered[1], d.id);
    });
    find = nets(ex, wires, st);
    L = find(key(src.id, 'L'));
    N = find(key(src.id, 'N'));
    PE = find(key(src.id, 'PE'));

    var out = { on: {}, coil: {}, faults: [] };
    if (L === N) out.faults.push({ code: 'short' });
    else if (L === PE) out.faults.push({ code: 'earthFault' });
    if (N === PE && L !== N) out.faults.push({ code: 'neutralEarth' });
    ex.devices.forEach(function (d) {
      var T = TYPES[d.type];
      if (T.load) out.on[d.id] = live(T.load[0], T.load[1], d.id);
      if (T.loads) {
        out.on[d.id] = {};
        Object.keys(T.loads).forEach(function (k) { out.on[d.id][k] = live(T.loads[k][0], T.loads[k][1], d.id); });
        if (out.on[d.id].up && out.on[d.id].down) out.faults.push({ code: 'bothDirections', dev: d.id });
      }
      if (T.coil) out.coil[d.id] = live(T.coil[0], T.coil[1], d.id);
    });
    out.find = find;
    out.L = L;
    out.N = N;
    out.PE = PE;
    return out;
  }

  // Appui sur un bouton-poussoir : relâché → enfoncé → relâché ; un télérupteur change d'état sur le front montant
  function press(ex, wires, state, id) {
    var s = Object.assign({}, state);
    var before = evaluate(ex, wires, s).coil;
    s[id] = 'down';
    var during = evaluate(ex, wires, s).coil;
    ex.devices.forEach(function (d) {
      if (TYPES[d.type].memory && during[d.id] && !before[d.id]) s[d.id] = s[d.id] === 'on' ? 'off' : 'on';
    });
    var held = s;
    s = Object.assign({}, held);
    s[id] = 'up';
    return { held: held, after: s };
  }

  function sameExpect(res, expect) {
    for (var id in expect) {
      var want = expect[id];
      var got = res.on[id];
      if (typeof want === 'object') {
        for (var k in want) if (!!(got && got[k]) !== want[k]) return false;
      } else if (!!got !== want) return false;
    }
    return true;
  }

  // Vérification complète : défauts de sécurité, fonctionnement attendu, couleurs. Renvoie une liste de messages.
  function check(ex, wires) {
    var errors = [];
    var warnings = [];
    var add = function (list, code, dev) {
      if (!list.some(function (m) { return m.code === code && m.dev === dev; })) list.push({ code: code, dev: dev });
    };
    // Tous les états des commandes (combinaisons) pour les défauts
    var combos = [initialState(ex)];
    ex.devices.forEach(function (d) {
      var T = TYPES[d.type];
      if (!T.states) return;
      var next = [];
      combos.forEach(function (c) {
        T.states.forEach(function (v) {
          var x = Object.assign({}, c);
          x[d.id] = v;
          next.push(x);
        });
      });
      combos = next;
    });
    // Télérupteurs : les deux positions du contact
    ex.devices.forEach(function (d) {
      if (!TYPES[d.type].memory) return;
      var next = [];
      combos.forEach(function (c) {
        ['off', 'on'].forEach(function (v) {
          var x = Object.assign({}, c);
          x[d.id] = v;
          next.push(x);
        });
      });
      combos = next;
    });
    var src = ex.devices.filter(function (d) { return d.type === 'supply'; })[0];
    combos.forEach(function (c) {
      var r = evaluate(ex, wires, c);
      r.faults.forEach(function (f) { add(errors, f.code, f.dev); });
      // Un interrupteur ne coupe jamais le neutre (la lampe éteinte resterait sous tension)
      ex.devices.forEach(function (d) {
        if (!SWITCHING[d.type]) return;
        TYPES[d.type].terms.forEach(function (t) {
          if (r.find(key(d.id, t)) === r.N && r.N !== r.L) add(errors, 'switchOnNeutral', d.id);
        });
      });
    });
    // Terre : chaque borne PE reliée à la terre de l'arrivée
    var r0 = evaluate(ex, wires, initialState(ex));
    ex.devices.forEach(function (d) {
      if (d.type === 'supply') return;
      if (TYPES[d.type].terms.indexOf('PE') >= 0 && r0.find(key(d.id, 'PE')) !== r0.find(key(src.id, 'PE'))) add(errors, 'noEarth', d.id);
    });
    // Couleurs : vert-jaune pour la terre et seulement pour elle ; bleu pour le neutre
    wires.forEach(function (w) {
      var net = r0.find(w.a);
      var isPE = net === r0.find(key(src.id, 'PE'));
      var isN = net === r0.find(key(src.id, 'N'));
      if (isPE && w.color !== 'gy') add(errors, 'peColor');
      if (!isPE && w.color === 'gy') add(errors, 'gyMisuse');
      if (isN && w.color !== 'blue') add(warnings, 'neutralColor');
      if (!isN && !isPE && w.color === 'blue') add(warnings, 'blueMisuse');
    });
    // Fonctionnement attendu
    var ok = true;
    if (!errors.some(function (e) { return e.code === 'short' || e.code === 'earthFault'; })) {
      (ex.cases || []).forEach(function (c) {
        var s = Object.assign(initialState(ex), c.set);
        if (!sameExpect(evaluate(ex, wires, s), c.expect)) ok = false;
      });
      // « Chaque commande inverse la lampe » (va-et-vient, inverseurs) : toute convention de câblage juste est acceptée
      if (ex.toggle) {
        var tg = ex.toggle;
        var combos2 = [initialState(ex)];
        tg.inputs.forEach(function (id) {
          var next = [];
          combos2.forEach(function (c) {
            TYPES[byId(ex, id).type].states.forEach(function (v) {
              var x = Object.assign({}, c);
              x[id] = v;
              next.push(x);
            });
          });
          combos2 = next;
        });
        var lit = false;
        combos2.forEach(function (c) {
          var on0 = !!evaluate(ex, wires, c).on[tg.output];
          if (on0) lit = true;
          tg.inputs.forEach(function (id) {
            var st2 = TYPES[byId(ex, id).type].states;
            var x = Object.assign({}, c);
            x[id] = st2[(st2.indexOf(c[id]) + 1) % st2.length];
            if (!!evaluate(ex, wires, x).on[tg.output] === on0) ok = false;
          });
        });
        if (!lit) ok = false;
      }
      if (ex.sequence) {
        var s = initialState(ex);
        ex.sequence.forEach(function (step) {
          if (step.press) s = press(ex, wires, s, step.press).after;
          if (step.set) s = Object.assign(s, step.set);
          if (!sameExpect(evaluate(ex, wires, s), step.expect)) ok = false;
        });
      }
    } else ok = false;
    if (!ok) add(errors, 'behaviour');
    // Les défauts les plus graves d'abord
    var rank = ['short', 'earthFault', 'neutralEarth', 'bothDirections', 'switchOnNeutral', 'noEarth', 'behaviour', 'peColor', 'gyMisuse'];
    errors.sort(function (x, y) { return rank.indexOf(x.code) - rank.indexOf(y.code); });
    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  var api = { TYPES: TYPES, COLORS: COLORS, initialState: initialState, evaluate: evaluate, press: press, check: check, key: key };
  root.CablageSim = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
