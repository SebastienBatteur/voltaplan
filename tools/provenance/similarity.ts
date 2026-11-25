/**
 * Empreintes de SIMILARITÉ (indices de filiation, jamais une preuve) : chaînes caractéristiques et séquences de
 * jetons normalisés, calculées sur le code JavaScript (source transpilée ou fichier distribué, minifié ou non).
 *
 * Utilisé à la construction (tools/provenance/plugin.ts), par les tests de robustesse et par tout scanner externe :
 * les algorithmes sont décrits dans docs/security/artifact-integrity.md (identifiant FP_ALGORITHM) pour être
 * réimplémentés sans ce code. Aucune dépendance au navigateur : jamais importé par l'application.
 *
 * Normalisation des jetons (résiste au renommage des variables locales, aux commentaires, au formatage et en partie
 * à la minification) :
 *  - identifiant → « i », SAUF après « . » ou « ?. » (nom de propriété : gardé, les minifieurs ne le renomment pas) ;
 *  - chaîne, gabarit → « s » (les chaînes ont leur propre empreinte) ; nombre → « n » ;
 *  - const/let/var → « v » ; true/false, !0/!1 → « b » ; undefined, void 0 → « u » ;
 *  - ponctuation que les minifieurs ajoutent ou retirent librement ( ; , { } ( ) ) : ignorée.
 */
import { createHash } from 'node:crypto';
import ts from 'typescript';

/** Identifiant de l'algorithme : change dès qu'un résultat change (normalisation, taille des séquences, hachage). */
export const FP_ALGORITHM = 'oss-fp/1';
export const SHINGLE = 6;
export const SKETCH_K = 512;
export const MIN_STRING = 6;

const DROP = new Set([';', ',', '{', '}', '(', ')']);

/** Hachage court (64 bits, hexadécimal) : identique pour tout scanner (SHA-256 tronqué). */
export function h64(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16);
}

/** Code TypeScript ou TSX → JavaScript (types retirés), sans minification : référence des empreintes. */
export function transpile(code: string, fileName = 'x.tsx'): string {
  return ts.transpileModule(code, {
    fileName,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, removeComments: true },
  }).outputText;
}

interface RawToken {
  kind: ts.SyntaxKind;
  text: string;
  value?: string;
}

/** Jetons bruts d'un code JavaScript (gabarits `${}` gérés ; commentaires et espaces ignorés). */
export function scan(code: string): RawToken[] {
  const sc = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, code);
  const out: RawToken[] = [];
  const braces: number[] = []; // profondeur des accolades à laquelle un gabarit attend sa suite
  let depth = 0;
  let prev: ts.SyntaxKind = ts.SyntaxKind.Unknown;
  for (let k = sc.scan(); k !== ts.SyntaxKind.EndOfFileToken; k = sc.scan()) {
    if (k === ts.SyntaxKind.SlashToken || k === ts.SyntaxKind.SlashEqualsToken) {
      // Expression régulière si la position l'exige (après un opérateur, une parenthèse ouvrante…)
      const punct = prev >= ts.SyntaxKind.FirstPunctuation && prev <= ts.SyntaxKind.LastPunctuation;
      const closes = prev === ts.SyntaxKind.CloseParenToken || prev === ts.SyntaxKind.CloseBracketToken || prev === ts.SyntaxKind.CloseBraceToken;
      const regexOk = prev === ts.SyntaxKind.Unknown || (punct && !closes) || prev === ts.SyntaxKind.ReturnKeyword || prev === ts.SyntaxKind.TypeOfKeyword || prev === ts.SyntaxKind.CaseKeyword;
      if (regexOk) k = sc.reScanSlashToken();
    }
    if (k === ts.SyntaxKind.OpenBraceToken) depth++;
    if (k === ts.SyntaxKind.CloseBraceToken) {
      if (braces.length && braces[braces.length - 1] === depth) {
        k = sc.reScanTemplateToken(false);
        if (k === ts.SyntaxKind.TemplateTail) braces.pop();
        out.push({ kind: k, text: sc.getTokenText(), value: sc.getTokenValue() });
        prev = k;
        continue;
      }
      depth--;
    }
    if (k === ts.SyntaxKind.TemplateHead) braces.push(depth);
    const t: RawToken = { kind: k, text: sc.getTokenText() };
    if (k === ts.SyntaxKind.StringLiteral || k === ts.SyntaxKind.NoSubstitutionTemplateLiteral || k === ts.SyntaxKind.TemplateHead) t.value = sc.getTokenValue();
    out.push(t);
    prev = k;
  }
  return out;
}

const isStr = (k: ts.SyntaxKind) =>
  k === ts.SyntaxKind.StringLiteral || k === ts.SyntaxKind.NoSubstitutionTemplateLiteral || (k >= ts.SyntaxKind.TemplateHead && k <= ts.SyntaxKind.TemplateTail);

/** Jetons normalisés (voir l'en-tête). */
export function normalizedTokens(code: string): string[] {
  const raw = scan(code);
  const out: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const { kind, text } = raw[i];
    const before = raw[i - 1]?.kind;
    if (DROP.has(text)) continue;
    if (kind === ts.SyntaxKind.ExclamationToken && raw[i + 1]?.kind === ts.SyntaxKind.NumericLiteral && (raw[i + 1].text === '0' || raw[i + 1].text === '1')) {
      out.push('b');
      i++;
      continue;
    }
    if (kind === ts.SyntaxKind.VoidKeyword && raw[i + 1]?.text === '0') {
      out.push('u');
      i++;
      continue;
    }
    if (kind === ts.SyntaxKind.Identifier || kind === ts.SyntaxKind.PrivateIdentifier) {
      if (text === 'undefined') out.push('u');
      else out.push(before === ts.SyntaxKind.DotToken || before === ts.SyntaxKind.QuestionDotToken ? '.' + text : 'i');
      continue;
    }
    if (kind === ts.SyntaxKind.TrueKeyword || kind === ts.SyntaxKind.FalseKeyword) out.push('b');
    else if (kind === ts.SyntaxKind.ConstKeyword || kind === ts.SyntaxKind.LetKeyword || kind === ts.SyntaxKind.VarKeyword) out.push('v');
    else if (isStr(kind)) out.push('s');
    else if (kind === ts.SyntaxKind.NumericLiteral || kind === ts.SyntaxKind.BigIntLiteral) out.push('n');
    else if (kind === ts.SyntaxKind.RegularExpressionLiteral) out.push('r');
    else if (kind === ts.SyntaxKind.DotToken || kind === ts.SyntaxKind.QuestionDotToken) continue; // porté par le nom de propriété
    else out.push(text);
  }
  return out;
}

/** Ensemble des séquences de `n` jetons consécutifs (hachées). */
export function shingles(tokens: string[], n = SHINGLE): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i + n <= tokens.length; i++) s.add(h64(tokens.slice(i, i + n).join(' ')));
  return s;
}

/** Chaînes du code (valeur réelle), normalisées (NFC, espaces réduits), assez longues et contenant une lettre. */
export function strings(code: string, min = MIN_STRING): Set<string> {
  const out = new Set<string>();
  for (const t of scan(code)) {
    if (t.value === undefined) continue;
    const v = t.value.normalize('NFC').replace(/\s+/g, ' ').trim();
    if (v.length >= min && /\p{L}/u.test(v)) out.add(v);
  }
  return out;
}

/** Échantillon « bottom-k » : les k plus petits hachages (MinHash). */
export function sketch(set: Iterable<string>, k = SKETCH_K): string[] {
  return [...new Set(set)].sort().slice(0, k);
}

/** Part de `ref` présente dans `target` (contenance, 0 à 1). */
export function containment(ref: Iterable<string>, target: Set<string>): number {
  let n = 0;
  let hit = 0;
  for (const x of ref) {
    n++;
    if (target.has(x)) hit++;
  }
  return n ? hit / n : 0;
}

export interface ComponentPrint {
  name: string;
  /** Hachages h64 des chaînes caractéristiques (absentes du corpus de fond). */
  strings: string[];
  /** Échantillon bottom-k des séquences de jetons caractéristiques. */
  tokens: string[];
  /** Nombre total de séquences et de chaînes caractéristiques avant échantillonnage. */
  counts: { strings: number; shingles: number };
}

export interface Background {
  strings: Set<string>;
  shingles: Set<string>;
}

/** Corpus de fond (bibliothèques, code générique) : ce qui y figure n'est jamais caractéristique. */
export function background(codes: Iterable<string>): Background {
  const b: Background = { strings: new Set(), shingles: new Set() };
  for (const c of codes) {
    for (const s of strings(c)) b.strings.add(s);
    for (const s of shingles(normalizedTokens(c))) b.shingles.add(s);
  }
  return b;
}

/** Empreinte d'un composant (codes JavaScript de ses modules), hors corpus de fond. */
export function componentPrint(name: string, codes: string[], bg: Background, k = SKETCH_K): ComponentPrint {
  const str = new Set<string>();
  const sh = new Set<string>();
  for (const c of codes) {
    for (const s of strings(c)) if (!bg.strings.has(s)) str.add(h64(s));
    for (const s of shingles(normalizedTokens(c))) if (!bg.shingles.has(s)) sh.add(s);
  }
  return { name, strings: [...str].sort(), tokens: sketch(sh, k), counts: { strings: str.size, shingles: sh.size } };
}

export interface TargetIndex {
  strings: Set<string>;
  shingles: Set<string>;
}

/** Index d'un code à examiner (tout un bundle, plusieurs fichiers concaténés…). */
export function indexTarget(codes: Iterable<string>): TargetIndex {
  const t: TargetIndex = { strings: new Set(), shingles: new Set() };
  for (const c of codes) {
    for (const s of strings(c)) t.strings.add(h64(s));
    for (const s of shingles(normalizedTokens(c))) t.shingles.add(s);
  }
  return t;
}

/** Scores d'un composant dans une cible : part de ses chaînes et de ses séquences retrouvées. */
export function score(p: ComponentPrint, t: TargetIndex): { strings: number; tokens: number } {
  return { strings: containment(p.strings, t.strings), tokens: containment(p.tokens, t.shingles) };
}
