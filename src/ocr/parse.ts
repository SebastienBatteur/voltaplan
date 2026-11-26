/**
 * Lecture du texte reconnu par l'OCR local (fonctions pures, testées). Aucune valeur n'est inventée : seuls des
 * motifs connus et sans ambiguïté sont retenus, et tout résultat reste une PROPOSITION à confirmer.
 *
 * Mesuré sur 18 photos réelles (docs/strategie/ASSISTANT-COLLECTE.md § 8) : plaque de compteur, étiquettes
 * imprimées et noms de pièces sont lus de façon utile ; les petites inscriptions des modules le sont mal (filtres
 * stricts ci-dessous pour écarter le bruit : « C2 », « D0 »…).
 */

/** Calibres normalisés des disjoncteurs (A). Un nombre hors de cette liste est du bruit. */
export const STANDARD_RATINGS = [1, 2, 3, 4, 6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];
/** Sensibilités normalisées des différentiels (mA). */
export const STANDARD_SENSITIVITIES = [10, 30, 100, 300, 500, 1000];

/** Texte OCR rendu comparable : espaces, confusions courantes de caractères dans les nombres. */
export function cleanOcr(s: string): string {
  return s
    .replace(/[‘’´`]/g, "'")
    .replace(/[×]/g, 'x')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface MeterPlate {
  /** Nombre de phases lu : « 3x… » ou « 220/380 », « 230/400 » → 3 ; tension seule 220/230 → 1. */
  phases?: 1 | 3;
  /** Tension lue (V), telle qu'imprimée (« 220/380 », « 230 »). */
  voltage?: string;
  /** Courant de base et maximal (« 10(40) A » → 10 et 40). */
  baseA?: number;
  maxA?: number;
  frequencyHz?: number;
  /**
   * Alimentation proposée, dans les valeurs du projet : triphasé avec neutre (220/380, 230/400) → « 3N x 400V ~ 50Hz » ;
   * triphasé sans neutre (« 3 x 230 V ») → « 3 x 230V ~ 50Hz » ; monophasé 230 V → « 2 x 230V ~ 50Hz ». Toujours à
   * confirmer par l'utilisateur.
   */
  supply?: string;
  /** Triphasé lu (« 3x10(40) A ») sans la tension : avec ou sans neutre, à choisir par l'utilisateur. */
  options?: string[];
  /** Extraits du texte qui justifient la lecture (affichés à l'utilisateur). */
  evidence: string[];
}

export function readMeterPlate(raw: string): MeterPlate {
  const t = cleanOcr(raw);
  const out: MeterPlate = { evidence: [] };
  const cur = /(3\s*x\s*)?(\d{1,2}(?:[.,]\d{1,2})?\s*-\s*)?(\d{1,2})\s*\(\s*(\d{2,3})\s*\)\s*A\b/i.exec(t);
  if (cur) {
    const base = Number(cur[3]);
    const max = Number(cur[4]);
    if (max > base && max <= 200) {
      out.baseA = base;
      out.maxA = max;
      out.evidence.push(cur[0].trim());
      if (cur[1]) out.phases = 3;
    }
  }
  const comp = /\b(?:3\s*x\s*)?(220|230|240)\s*\/\s*(380|400|415)\s*V/i.exec(t);
  const simple = /\b(220|230|240)\s*V\b/i.exec(t);
  if (comp) {
    out.voltage = `${comp[1]}/${comp[2]}`;
    out.phases = 3;
    out.evidence.push(comp[0].trim());
  } else if (simple) {
    out.voltage = simple[1];
    out.phases ??= 1;
    out.evidence.push(simple[0].trim());
  }
  const hz = /\b(50|60)\s*Hz/i.exec(t);
  if (hz) out.frequencyHz = Number(hz[1]);
  const delta = /\b3\s*x\s*(220|230)\s*V\b(?!\s*\/)/i.exec(t);
  if (comp) out.supply = '3N x 400V ~ 50Hz';
  else if (delta) {
    out.phases = 3;
    out.voltage = delta[1];
    out.supply = '3 x 230V ~ 50Hz';
    if (!out.evidence.includes(delta[0].trim())) out.evidence.push(delta[0].trim());
  } else if (out.phases === 1 && out.voltage) out.supply = '2 x 230V ~ 50Hz';
  else if (out.phases === 3) out.options = ['3N x 400V ~ 50Hz', '3 x 230V ~ 50Hz'];
  return out;
}

export interface DeviceText {
  ratedCurrentA?: number;
  curve?: string;
  residualCurrentmA?: number;
  evidence: string[];
}

/**
 * Inscriptions d'un appareil modulaire : « C16 », « B 20 », « N22-L (20 A) », « 30mA », « IΔn 0,03 A »,
 * « 0,3 A ». Calibres et sensibilités hors des valeurs normalisées ignorés.
 */
export function readDevice(raw: string): DeviceText {
  const t = cleanOcr(raw);
  const out: DeviceText = { evidence: [] };
  const curve = /(?:^|[^A-Za-z0-9])([BCD])\s?(\d{1,3})(?![0-9])/.exec(t);
  if (curve && STANDARD_RATINGS.includes(Number(curve[2]))) {
    out.curve = curve[1];
    out.ratedCurrentA = Number(curve[2]);
    out.evidence.push(curve[0].trim());
  } else {
    const paren = /\(\s*(\d{1,3})\s*A\s*\)/.exec(t) ?? /(?:^|[^0-9,.])(\d{1,3})\s?A\b(?!\s*\))/.exec(t);
    if (paren && STANDARD_RATINGS.includes(Number(paren[1]))) {
      out.ratedCurrentA = Number(paren[1]);
      out.evidence.push(paren[0].trim());
    }
  }
  const ma = /(\d{2,4})\s*mA\b/i.exec(t);
  const amp = /(?:I\s*[ΔA4]?\s*n\s*)?0\s*[,.]\s*(0?3|1|5)\s*A\b/i.exec(t);
  if (ma && STANDARD_SENSITIVITIES.includes(Number(ma[1]))) {
    out.residualCurrentmA = Number(ma[1]);
    out.evidence.push(ma[0].trim());
  } else if (amp) {
    const v = Math.round(parseFloat('0.' + amp[1]) * 1000);
    if (STANDARD_SENSITIVITIES.includes(v)) {
      out.residualCurrentmA = v;
      out.evidence.push(amp[0].trim());
    }
  }
  return out;
}

/** Une ligne de texte OCR ressemble-t-elle à une étiquette lisible (mots, pas du bruit) ? */
export function plausibleLabel(raw: string): string | undefined {
  const t = cleanOcr(raw).replace(/^[^A-Za-zÀ-ÿ0-9]+|[^A-Za-zÀ-ÿ0-9.)]+$/g, '');
  if (t.length < 3) return undefined;
  const letters = (t.match(/[A-Za-zÀ-ÿ]/g) ?? []).length;
  const words = t.split(/\s+/).filter((w) => /[A-Za-zÀ-ÿ]{3,}/.test(w));
  if (!words.length || letters / t.length < 0.6) return undefined;
  return t;
}

/** Mot reconnu avec sa boîte (pixels de l'image analysée). */
export interface OcrWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence?: number;
}

const ROOMS: { re: RegExp; withNumber?: boolean }[] = [
  { re: /^hall de nuit$|^nachthal$/ },
  { re: /^salle de bains?$|^salle d'eau$|^badkamer$|^bathroom$/ },
  { re: /^salle a manger$|^eetkamer$|^dining room$/ },
  { re: /^(chambre|ch|slaapkamer|kamer|bedroom)$/, withNumber: true },
  {
    re: /^(cuisine|keuken|kitchen|living|salon|sejour|leefruimte|woonkamer|garage|bains?|bad|sdb|wc|toilettes?|toilet|hall|inkom|entree|cellier|buanderie|berging|wasplaats|bureau|grenier|zolder|cave|kelder|veranda|terrasse|terras|dressing|debarras|atelier|zitkamer)$/,
  },
];

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9' ]/g, '')
    .trim();

/** Distance d'édition (Levenshtein). */
export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}

/** Mots du vocabulaire des pièces (forme repliée), pour la correction des erreurs de lecture. */
export const ROOM_WORDS = [
  'cuisine', 'keuken', 'kitchen', 'living', 'salon', 'sejour', 'garage', 'bains', 'bain', 'badkamer', 'toilettes',
  'toilet', 'hall', 'nuit', 'cellier', 'buanderie', 'berging', 'bureau', 'grenier', 'zolder', 'kelder', 'veranda',
  'terrasse', 'chambre', 'slaapkamer', 'kamer', 'bedroom', 'nachthal', 'eetkamer', 'manger', 'dressing', 'atelier',
];

/**
 * Correction d'un mot mal lu vers le vocabulaire (« baing » → « bains », « cuisi » → « cuisine », « charnbre » →
 * « chambre »), à la manière d'un vocabulaire imposé au décodage : seulement si la ressemblance est forte (une
 * erreur pour 5 à 6 lettres, deux à partir de 7, préfixe d'au moins 5 lettres) et sans hésitation entre deux mots.
 * Les mots courts (< 5 lettres) ne sont jamais corrigés : « bare » ou « bale » ne deviennent pas « bain ».
 */
export function correctWord(word: string, vocabulary: string[] = ROOM_WORDS): string | undefined {
  const w = fold(word);
  if (vocabulary.includes(w)) return w;
  if (w.length < 5) return undefined;
  const max = w.length >= 7 ? 2 : 1;
  const hits = vocabulary.filter((v) => v.length >= 5 && (editDistance(w, v) <= max || (w.length >= 5 && v.startsWith(w))));
  return hits.length === 1 ? hits[0] : undefined;
}

export interface RoomLabel {
  text: string;
  /** Centre de la boîte (pixels de l'image analysée). */
  x: number;
  y: number;
}

/**
 * Noms de pièces parmi les mots reconnus sur un plan : vocabulaire FR/NL/EN connu, mots voisins sur la même
 * ligne regroupés (« hall de nuit », « chambre 3 »). Un mot hors vocabulaire n'est jamais pris pour une pièce.
 */
export function roomLabels(words: OcrWord[]): RoomLabel[] {
  // Un mot lu d'un bloc (« hall-de-nuit ») est découpé ; ses morceaux restent voisins (même source).
  const ws = words
    .filter((w) => w.text.trim())
    .flatMap((w, src) =>
      fold(w.text.replace(/-/g, ' '))
        .split(/\s+/)
        .filter(Boolean)
        .map((f, part) => ({ ...w, src, part, f: correctWord(f) ?? f })),
    );
  const used = new Set<number>();
  const out: RoomLabel[] = [];
  const sameLine = (a: (typeof ws)[number], b: (typeof ws)[number]) => {
    if (a.src === b.src) return b.part === a.part + 1;
    const h = Math.max(a.bbox.y1 - a.bbox.y0, b.bbox.y1 - b.bbox.y0);
    const gap = b.bbox.x0 - a.bbox.x1;
    return Math.abs((a.bbox.y0 + a.bbox.y1) / 2 - (b.bbox.y0 + b.bbox.y1) / 2) < h * 0.6 && gap > -h && gap < h * 2.5;
  };
  for (let i = 0; i < ws.length; i++) {
    if (used.has(i)) continue;
    // Groupes de 3, 2 puis 1 mots voisins
    for (const len of [3, 2, 1]) {
      const idx = [i];
      for (let k = 1; k < len; k++) {
        const prev = ws[idx[idx.length - 1]];
        const j = ws.findIndex((w, n) => !used.has(n) && !idx.includes(n) && n !== i && sameLine(prev, w));
        if (j < 0) break;
        idx.push(j);
      }
      if (idx.length !== len) continue;
      const parts = idx.map((n) => ws[n].f);
      const phrase = parts.join(' ');
      const last = parts[parts.length - 1];
      const head = len > 1 && /^\d{1,2}$/.test(last) ? parts.slice(0, -1).join(' ') : phrase;
      const rule = ROOMS.find((r) => r.re.test(head));
      if (!rule) continue;
      if (head !== phrase && !rule.withNumber) continue;
      const box = idx.map((n) => ws[n].bbox);
      const x0 = Math.min(...box.map((b) => b.x0));
      const x1 = Math.max(...box.map((b) => b.x1));
      const y0 = Math.min(...box.map((b) => b.y0));
      const y1 = Math.max(...box.map((b) => b.y1));
      const text = [...new Set(idx.map((n) => ws[n].src))].map((src) => ws.find((w) => w.src === src)!.text.trim()).join(' ');
      out.push({ text, x: (x0 + x1) / 2, y: (y0 + y1) / 2 });
      idx.forEach((n) => used.add(n));
      break;
    }
  }
  return out;
}
