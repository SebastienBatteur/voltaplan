/**
 * Modèle de départ « maison type » : un tableau déjà garni des circuits les plus courants d'une habitation
 * (éclairage, prises, salle de bain et lave-linge sous deux différentiels 30 mA, cuisinière, terre), pour qu'un
 * débutant parte d'un exemple au lieu d'une page blanche. Ce n'est qu'un point de départ, à adapter :
 * le contrôle RGIE de Voltaplan s'applique ensuite comme à tout projet.
 */
import { createNode, emptyProject } from './tree';
import type { ElNode, Project } from './types';

type T = (key: string) => string;

const node = (kind: ElNode['kind'], props: ElNode['props'] = {}, children: ElNode[] = [], location?: string): ElNode => {
  const n = createNode(kind, props);
  n.children = children;
  if (location) n.location = location;
  return n;
};

/** Pôles d'un disjoncteur selon le réseau : bipolaire sur un réseau 2 × 230 V (sans neutre), sinon phase + neutre. */
export const polesFor = (supply: string | undefined) => (supply?.startsWith('2') ? '2P' : '1P+N');

/** Arborescence de la maison type, sous le tableau principal. */
export function typicalHouseCircuits(t: T, supply?: string): ElNode[] {
  const poles = polesFor(supply);
  const mcb = (name: string, amps: number, cable: ElNode) => node('protection', { device: 'mcb', circuitName: name, ratedCurrent: amps, poles, curve: 'C' }, [cable]);
  const cable = (section: number, children: ElNode[]) => node('cable', { cableType: 'VOB', section, conductors: 3 }, children);
  const room = (k: string) => t('template.room.' + k);
  const lit = (where: string) => node('switch', { switchType: 'single' }, [node('light')], where);

  // RGIE 4.2.4.3 b (depuis le 1/6/2023) : prises, éclairage, salle de bain et lavage derrière un 30 mA, au plus
  // 8 circuits par 30 mA ; la cuisinière (appareil fixe) peut rester directement sous le différentiel général.
  const rcd30 = (children: ElNode[]) => node('protection', { device: 'rcd', ratedCurrent: 40, residualCurrent: 30, poles: '2P', rcdType: 'A' }, children);
  return [
    rcd30([
      mcb(t('template.circuit.lights'), 16, cable(1.5, [lit(room('living')), lit(room('kitchen')), lit(room('hall'))])),
      mcb(t('template.circuit.sockets'), 20, cable(2.5, [node('socket', { count: 2 }, [], room('living')), node('socket', { count: 2 }, [], room('living')), node('socket', { count: 1 }, [], room('hall'))])),
      mcb(t('template.circuit.kitchen'), 20, cable(2.5, [node('socket', { count: 2 }, [], room('kitchen')), node('socket', { count: 2 }, [], room('kitchen'))])),
    ]),
    rcd30([
      mcb(t('template.circuit.bathroom'), 20, cable(2.5, [node('socket', { count: 1, wetRoom: 'yes' }, [], room('bathroom'))])),
      mcb(t('template.circuit.washing'), 20, cable(2.5, [node('socket', { count: 1 }, [node('appliance', { applianceType: 'washingMachine' })], room('laundry'))])),
    ]),
    mcb(t('template.circuit.cooker'), 32, cable(6, [node('appliance', { applianceType: 'cooker' }, [], room('kitchen'))])),
    node('earthBar', {}, [node('earth')]),
  ];
}

/** Projet neuf avec la maison type déjà en place. */
export function typicalHouseProject(t: T, supply?: string): Project {
  const p = emptyProject();
  const fill = (nodes: ElNode[]): boolean => {
    for (const n of nodes) {
      if (n.kind === 'board') {
        n.children = typicalHouseCircuits(t, supply);
        return true;
      }
      if (fill(n.children)) return true;
    }
    return false;
  };
  fill(p.roots);
  return p;
}
