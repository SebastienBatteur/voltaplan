/**
 * Banc d'évaluation (tools/ai-eval) : appariement, exactitude par champ, valeurs inventées, rapport. Aucun appel à
 * l'IA : les lectures des exemples sont SIMULÉES (écrites à la main) et ne mesurent rien de la qualité réelle.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PhotoReadingT } from '../src/ai/boardPhoto';
import { checkTruth, matchDevices, report, scorePhoto, total, type GroundTruth } from '../tools/ai-eval/score';

const dir = join(__dirname, '../tools/ai-eval/examples');
const load = <T>(f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as T;

describe('banc d’évaluation de la lecture des tableaux', () => {
  const t1 = load<GroundTruth>('exemple-1.truth.json');
  const p1 = load<PhotoReadingT>('exemple-1.prediction.json');
  const t2 = load<GroundTruth>('exemple-2.truth.json');
  const p2 = load<PhotoReadingT>('exemple-2.prediction.json');

  it('vérités terrain des exemples et modèle valides', () => {
    expect(checkTruth(t1)).toBeNull();
    expect(checkTruth(t2)).toBeNull();
    expect(checkTruth(JSON.parse(readFileSync(join(dir, '../template.truth.json'), 'utf8')))).toBeNull();
    expect(checkTruth({ ...t1, format: 'autre' })).toMatch(/format/);
  });

  it('exactitude par champ, valeur inventée comptée à part, cache ignoré', () => {
    const s = scorePhoto('exemple-1', t1, p1);
    expect([s.truth, s.predicted, s.matched]).toEqual([6, 6, 6]); // le cache (blank) n'est pas un appareil
    expect(s.fields.rating).toMatchObject({ n: 5, correct: 3, wrong: 1, invented: 1 }); // 16→10 faux ; D : 16 inventé
    expect(s.fields.label.wrong).toBe(1); // « Ecl. ch.7 » au lieu de « Ecl. ch.1 »
    expect(s.fields.label.correct).toBe(5); // « PC CUIS » = « PC cuis. » (casse et ponctuation ignorées)
    expect(s.confusion['teleswitch → contactor']).toBe(1);
  });

  it('appareil 4 modules lu comme deux de 2 : largeur fausse et un appareil en trop', () => {
    const s = scorePhoto('exemple-2', t2, p2);
    expect(s.extraDevices).toBe(1);
    expect(s.fields.width.wrong).toBe(1);
    // Calibre lu sur un différentiel alors que la vérité ne l'évalue pas : non compté
    expect(s.fields.rating.n).toBe(4);
  });

  it('appariement : même module d’abord, puis recouvrement', () => {
    const m = matchDevices(
      [
        { row: 0, startModule: 0, widthModules: 2, kind: 'rcd' },
        { row: 0, startModule: 2, widthModules: 1, kind: 'mcb' },
      ],
      [
        { row: 0, d: { ...p1.rows[0].devices[1], startModule: 1, widthModules: 2 } },
        { row: 0, d: { ...p1.rows[0].devices[1], startModule: 2 } },
      ],
    );
    expect(m).toEqual([
      [1, 1],
      [0, 0],
    ]);
  });

  it('rapport : avertissement sur les lectures simulées, totaux', () => {
    const scores = [scorePhoto('exemple-1', t1, p1), scorePhoto('exemple-2', t2, p2)];
    expect(total(scores).matched).toBe(11);
    const md = report(scores, { title: 'Essai', mode: 'simulé', date: '2026-11-24' });
    expect(md).toContain('ne dit rien de la qualité réelle');
    expect(md).toContain('| Calibre |');
    expect(md).toContain('teleswitch → contactor ⚠');
  });
});
