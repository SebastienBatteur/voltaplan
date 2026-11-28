/**
 * Fichier d'essai de l'essai de compatibilité, écrit par la version COURANTE : ancien relevé migré (valeurs
 * historiques), une prise confirmée (origine et auteur), une prise sans terre (non-conformité sur une valeur
 * historique), une protection de relevé sans valeurs, réseau inconnu. Aucune donnée réelle.
 *
 *   vite-node tools/compat/fixture.ts <fichier.voltaplan> <ids.json>
 */
import { writeFileSync } from 'node:fs';
import { AssetStore, MemoryAssetBackend } from '../../src/format/assets';
import { AssetSession } from '../../src/format/session';
import { serializeProject } from '../../src/io/projectData';
import { createNode, emptyProject } from '../../src/model/tree';
import { parseProjectText } from '../../src/model/migrate';
import { confirmHistoric } from '../../src/assist/apply';

const [file, idsFile] = process.argv.slice(2).filter((x) => x !== '--');

async function main() {
  const p = emptyProject();
  delete p.meta.provenanceSince; // enregistré avant le suivi : migré ci-dessous comme à l'ouverture
  p.meta.title = 'Essai de compatibilité';
  p.meta.installationKind = 'existing';
  p.meta.installationDate = '1998-01-01';
  p.meta.installer = { name: 'Installateur Essai', address: {} };
  const board = p.roots[0].children[0].children[0].children[0];
  const circuit = (sockProps: Record<string, boolean>) => {
    const sock = createNode('socket', sockProps);
    const prot = createNode('protection', { device: 'mcb', ratedCurrent: 16, curve: 'C', poles: '1P+N' });
    prot.children.push({ ...createNode('cable', { section: 2.5 }), children: [sock] });
    board.children.push(prot);
    return sock;
  };
  const confirmedSocket = circuit({ earth: true, childSafety: true });
  const socketNoEarth = circuit({ earth: false, childSafety: true });
  let project = parseProjectText(JSON.stringify(p)).project;
  project = confirmHistoric(project, confirmedSocket.id);
  // Après la migration : protection ajoutée dans le relevé (aucune valeur), réseau inconnu
  const emptyProt = createNode('protection', { circuitName: 'X' }, { survey: true });
  // … et une prise de relevé dont la terre et les obturateurs ne sont pas renseignés
  const unsetSocket = createNode('socket', {}, { survey: true });
  emptyProt.children.push({ ...createNode('cable', {}, { survey: true }), children: [unsetSocket] });
  project.roots[0].children[0].children[0].children[0].children.push(emptyProt);
  project = { ...project, meta: { ...project.meta, supply: '' } };
  const session = new AssetSession(() => new AssetStore(new MemoryAssetBackend()));
  const blob = (await serializeProject(project, undefined, session))!;
  writeFileSync(file, Buffer.from(await blob.arrayBuffer()));
  writeFileSync(idsFile, JSON.stringify({ emptyProt: emptyProt.id, unsetSocket: unsetSocket.id, socketNoEarth: socketNoEarth.id, confirmedSocket: confirmedSocket.id }));
}
void main();
