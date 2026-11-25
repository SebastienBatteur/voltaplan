/**
 * Transfert de la configuration IA entre appareils (src/ai/transfer.ts) : la clé reste chiffrée par la phrase
 * secrète, le code est dans la partie « # » de l'adresse (jamais envoyée au serveur) et retiré dès l'ouverture.
 */
import { describe, expect, it } from 'vitest';
import { aiTransferLink, decodeAiTransfer, encodeAiTransfer, PUBLIC_APP_URL, takeAiTransferFromLocation } from '../src/ai/transfer';
import { seal, unseal } from '../src/ai/secureStore';
import { DEFAULT_AI, type AiSettings } from '../src/ai/settings';

const SECRET = 'sk-ant-api03-ceci-est-une-cle-de-test';

async function settings(): Promise<AiSettings> {
  return { ...DEFAULT_AI, enabled: true, model: 'claude-opus-5-5', key: await seal(SECRET, 'phrase secrète de test', 1000), permissions: { ...DEFAULT_AI.permissions, boardFromPhoto: true } };
}

describe('transfert de la configuration IA', () => {
  it('aller-retour : mêmes réglages, clé toujours chiffrée, déverrouillable avec la phrase secrète seulement', async () => {
    const s = await settings();
    const code = encodeAiTransfer(s);
    expect(code).not.toContain(SECRET);
    expect(atob(code.replace(/-/g, '+').replace(/_/g, '/'))).not.toContain(SECRET);
    const back = decodeAiTransfer(code);
    expect(back).toMatchObject({ provider: 'anthropic', model: 'claude-opus-5-5', permissions: { boardFromPhoto: true, planFromPhoto: false } });
    await expect(unseal(back.key!, 'phrase secrète de test')).resolves.toBe(SECRET);
    await expect(unseal(back.key!, 'mauvaise phrase')).rejects.toBeTruthy();
  });

  it('lien : partie « # », adresse publique depuis le bureau ou un serveur local', async () => {
    const s = await settings();
    const web = aiTransferLink(s, { protocol: 'https:', hostname: 'voltaplan.org', origin: 'https://voltaplan.org', pathname: '/app/' });
    expect(web.startsWith('https://voltaplan.org/app/#ia=')).toBe(true);
    const desk = aiTransferLink(s, { protocol: 'http:', hostname: 'tauri.localhost', origin: 'http://tauri.localhost', pathname: '/' });
    expect(desk.startsWith(PUBLIC_APP_URL + '#ia=')).toBe(true);
    // Lien complet, fragment ou code seul : même résultat
    expect(decodeAiTransfer(web).model).toBe('claude-opus-5-5');
    expect(decodeAiTransfer(web.slice(web.indexOf('#'))).model).toBe('claude-opus-5-5');
    expect(decodeAiTransfer(encodeAiTransfer(s)).model).toBe('claude-opus-5-5');
  });

  it('code abîmé ou étranger : refusé', () => {
    expect(() => decodeAiTransfer('pas un code')).toThrow();
    expect(() => decodeAiTransfer(btoa(JSON.stringify({ v: 1, provider: 'inconnu', model: 'x' })))).toThrow();
    expect(() => decodeAiTransfer(btoa(JSON.stringify({ v: 1, provider: 'anthropic', model: 'x', key: { v: 1 } })))).toThrow();
  });

  it('ouverture par le lien : code rendu une fois, puis retiré de la barre d’adresse', () => {
    const calls: string[] = [];
    const loc = { hash: '#ia=ABC', pathname: '/app/', search: '?x=1' } as Location;
    const hist = { state: null, replaceState: (_s: unknown, _t: string, url: string) => calls.push(url) } as unknown as History;
    expect(takeAiTransferFromLocation(loc, hist)).toBe('ia=ABC');
    expect(calls).toEqual(['/app/?x=1']);
    expect(takeAiTransferFromLocation({ hash: '', pathname: '/', search: '' } as Location, hist)).toBeNull();
  });
});
