/**
 * Mots d'un document d'installation électrique (FR, NL, EN, DE) : test léger, sur un extrait seulement, pour dire si
 * un fichier non reconnu (ou un PDF) parle d'électricité avant toute lecture coûteuse. Fonction pure, testée.
 */

/** Mots et expressions sans accents, en minuscules ; les mots trop courants ailleurs (« section », « bord ») sont exclus. */
const WORDS = [
  // Réglementation, documents
  'rgie',
  'arei',
  'unifilaire',
  'eendraad',
  'single-line',
  'single line diagram',
  'einlinien',
  'plan de position',
  'situatieplan',
  'situationsplan',
  'installation electrique',
  'elektrische installatie',
  'electrical installation',
  'elektroinstallation',
  'elektrische anlage',
  'lageplan',
  'verteiler',
  'schaltplan',
  // Tableau et protections
  'disjoncteur',
  'differentiel',
  'aardlek',
  'fehlerstrom',
  'residual current',
  'circuit breaker',
  'leitungsschutz',
  'sicherungsautomat',
  'automaat',
  'zekering',
  'fusible',
  'rcbo',
  'verdeelbord',
  'verdeelkast',
  'tableau electrique',
  'tableau divisionnaire',
  'tableau principal',
  'hoofdbord',
  'stromkreis',
  'stroomkring',
  'kring',
  'circuit',
  '30 ma',
  '30ma',
  '300 ma',
  '300ma',
  'mm2',
  'mm²',
  '230v',
  '400v',
  '230 v',
  '400 v',
  // Points
  'interrupteur',
  'schakelaar',
  'prise de courant',
  'stopcontact',
  'steckdose',
  'socket outlet',
  'point lumineux',
  'lichtpunt',
  'eclairage',
  'verlichting',
  'beleuchtung',
  'aarding',
  'prise de terre',
  'erdung',
];

/** Extrait lu au plus (caractères). */
export const WORDS_SAMPLE = 256 * 1024;

const norm = (s: string) => s.slice(0, WORDS_SAMPLE).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Nombre de mots différents d'un document électrique trouvés dans le texte (extrait du début). */
export function electricScore(text: string): number {
  const t = norm(text);
  return WORDS.filter((w) => t.includes(w)).length;
}

/** Au moins trois mots différents : le document parle d'une installation électrique. */
export const looksElectric = (text: string) => electricScore(text) >= 3;
