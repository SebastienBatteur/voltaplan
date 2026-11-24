/** Tests techniques du moteur réglementaire (contexte, éditions, classement), indépendants de l'interprétation du RGIE. */
import { classify, editionAt, normDate, partContext, severityOf } from '../src/rules/context';
import { BE_EDITIONS, BE_RULES } from '../src/rules/be/catalog';
import { getRulePack, findRulePack } from '../src/rules';
import { createNode, emptyProject } from '../src/model/tree';
import type { RuleMeta } from '../src/rules/types';

describe('dates et éditions', () => {
  it('normalise les dates partielles', () => {
    expect(normDate('2024')).toBe('2024-01-01');
    expect(normDate('2024-3')).toBe('2024-03-01');
    expect(normDate(' 2020-06-01 ')).toBe('2020-06-01');
    expect(normDate('juin 2020')).toBeUndefined();
    expect(normDate(undefined)).toBeUndefined();
  });

  it('bornes des éditions : début inclus, fin exclue', () => {
    expect(editionAt(BE_EDITIONS, '1981-09-30')?.id).toBe('pre1981');
    expect(editionAt(BE_EDITIONS, '1981-10-01')?.id).toBe('1981');
    expect(editionAt(BE_EDITIONS, '2020-05-31')?.id).toBe('1981');
    expect(editionAt(BE_EDITIONS, '2020-06-01')?.id).toBe('2020');
  });

  it('les éditions se suivent sans trou ni chevauchement', () => {
    for (let i = 1; i < BE_EDITIONS.length; i++) expect(BE_EDITIONS[i].from).toBe(BE_EDITIONS[i - 1].until);
  });
});

describe('contexte d’une partie', () => {
  const pack = getRulePack('BE-RGIE');
  it('l’élément le plus proche l’emporte sur ses ancêtres et sur le projet', () => {
    const p = emptyProject();
    p.meta.installationDate = '2022';
    const board = createNode('board', { installedOn: '1975' });
    const prot = createNode('protection', { installedOn: '2024-02' });
    expect(partContext(p, pack, [board]).edition).toBe('pre1981');
    expect(partContext(p, pack, [board, prot]).edition).toBe('2020');
    expect(partContext(p, pack, []).edition).toBe('2020');
  });

  it('une partie d’une édition antérieure n’est jamais « neuve »', () => {
    const p = emptyProject();
    const prot = createNode('protection', { installedOn: '1990', installationKind: 'new' });
    expect(partContext(p, pack, [prot])).toMatchObject({ edition: '1981', isNew: false, current: false });
  });

  it('ancien modèle sans date : rgieVersion « old » → édition précédente', () => {
    const p = emptyProject();
    p.meta.rgieVersion = 'old';
    expect(partContext(p, pack, []).edition).toBe('1981');
  });
});

describe('classement', () => {
  const ctxNew = { edition: '2020', isNew: true, current: true };
  const ctxOld = { edition: '1981', isNew: false, current: false };
  const rule = (m: Partial<RuleMeta>): RuleMeta => ({ id: 'R-X', kind: 'nonCompliance', hazard: 'medium', ...m });

  it('neuf : non-conformité bloquante', () => {
    expect(classify({ ruleId: 'R-X' }, rule({}), ctxNew)).toMatchObject({ status: 'nonCompliant', blocking: true, severity: 'error' });
  });

  it('existant : sécurité bloquante, le reste en recommandation', () => {
    expect(classify({ ruleId: 'R-X' }, rule({ hazard: 'high' }), ctxOld)).toMatchObject({ status: 'nonCompliant', blocking: true });
    expect(classify({ ruleId: 'R-X' }, rule({ hazard: 'low' }), ctxOld)).toMatchObject({ status: 'recommendation', blocking: false, severity: 'info' });
  });

  it('statut imposé par la règle (vérification manuelle) : jamais bloquant', () => {
    expect(classify({ ruleId: 'R-X', status: 'manualCheck' }, rule({}), ctxNew)).toMatchObject({ status: 'manualCheck', blocking: false });
  });

  it('sévérité dérivée', () => {
    expect(severityOf('nonCompliant', false)).toBe('warning');
    expect(severityOf('insufficientData', false)).toBe('warning');
    expect(severityOf('manualCheck', false)).toBe('info');
    expect(severityOf('derogation', false)).toBe('info');
  });
});

describe('catalogue', () => {
  it('chaque règle du catalogue a une gravité et un texte traduit', async () => {
    const { translate } = await import('../src/i18n');
    for (const id of Object.keys(BE_RULES)) {
      expect(BE_RULES[id].hazard).toBeDefined();
      expect(translate('fr', 'rule.' + id)).not.toBe('rule.' + id);
    }
  });

  it('référentiel inconnu : pas de repli silencieux', () => {
    expect(findRulePack('XX-NONE')).toBeUndefined();
    expect(findRulePack(undefined)?.id).toBe('BE-RGIE');
  });
});
