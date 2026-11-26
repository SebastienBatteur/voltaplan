/**
 * Recherche dans la palette (éléments et mobilier) : on tape un mot dans n'importe quelle langue de l'application
 * (« stopcontact », « Steckdose », « prise ») et on retrouve le pictogramme. Sont cherchés le nom du type, et pour les
 * éléments ses variantes (types d'appareil, d'interrupteur, d'éclairage…), dans toutes les langues.
 */
import { LANGS, translate } from '../i18n';
import { PROP_SCHEMAS } from '../model/schema';
import type { NodeKind } from '../model/types';
import { FURNITURE, type FurnitureKind } from '../plan/furniture';

/** Minuscules sans accents ni ponctuation. */
export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const inAllLangs = (key: string) => LANGS.map((l) => translate(l.code, key)).filter((s) => s !== key);

/** Mots courants absents des libellés de l'application (langage de chantier, belgicismes). */
const SYNONYMS: Partial<Record<NodeKind, string[]>> = {
  socket: ['stopcontact', 'prise de courant', 'Schuko', 'outlet'],
  light: ['lampe', 'luminaire', 'lichtpunt', 'lamp', 'spot', 'applique'],
  switch: ['inter', 'commutateur', 'lichtschakelaar'],
  protection: ['disjoncteur', 'différentiel', 'fusible', 'automaat', 'verliesstroomschakelaar', 'zekering', 'breaker', 'RCD'],
  board: ['coffret', 'armoire', 'verdeelkast', 'zekeringkast', 'Verteiler'],
  cable: ['fil', 'gaine', 'leiding', 'kabel', 'wire'],
  appliance: ['électroménager', 'toestel'],
  battery: ['stockage', 'thuisbatterij', 'Speicher', 'storage'],
  inverter: ['onduleur', 'omvormer', 'Wechselrichter'],
  solarPanel: ['PV', 'photovoltaïque', 'zonnepaneel', 'Solarmodul'],
  meter: ['compteur', 'teller', 'kWh'],
  earth: ['terre', 'aarding', 'Erdung', 'piquet'],
  detector: ['détecteur', 'PIR', 'bewegingsmelder'],
  bell: ['sonnette', 'bel', 'deurbel'],
};

/** Mots-clés d'un type d'élément : son nom et ceux de ses variantes, dans toutes les langues. */
export function kindKeywords(kind: NodeKind): string {
  const words = [...inAllLangs('kind.' + kind), ...(SYNONYMS[kind] ?? [])];
  for (const def of PROP_SCHEMAS[kind] ?? []) {
    // Variantes (type d'appareil, d'interrupteur…), pas les choix « oui / non / non précisé »
    if (def.type !== 'enum' || !def.options || !/Type$/.test(def.key)) continue;
    for (const o of def.options) words.push(...inAllLangs(`enum.${def.key}.${o}`));
  }
  return normalize(words.join(' '));
}

export const furnitureKeywords = (k: FurnitureKind) => normalize(inAllLangs('furniture.' + k).join(' '));

/** Tous les mots de la recherche se retrouvent dans les mots-clés (début de mot, pour « lave » → « lave-linge »). */
export function matches(query: string, keywords: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const words = ` ${keywords}`;
  return q.split(' ').every((w) => words.includes(' ' + w));
}

export function searchFurniture(query: string): Set<FurnitureKind> {
  return new Set((Object.keys(FURNITURE) as FurnitureKind[]).filter((k) => matches(query, furnitureKeywords(k))));
}
