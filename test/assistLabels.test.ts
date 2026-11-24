/**
 * Étiquettes de tableaux (FR, NL, EN, abréviations courantes en Belgique). Chaînes inventées pour les tests, dans le
 * style des étiquettes réelles : aucune donnée de client.
 */
import { interpretLabel, normLabel, usageKey } from '../src/assist/labels';

const usages = (l: string) => interpretLabel(l).usages.map(usageKey);

describe('normalisation', () => {
  it.each([
    ['Ch.1', 'ch 1'],
    ['SLPK2', 'slpk 2'],
    ['L-L', 'll'],
    ['S.D.B.', 'sdb'],
    ['PC cuis.', 'pc cuis'],
    ['Éclairage  Séjour', 'eclairage sejour'],
  ])('« %s » → « %s »', (a, b) => expect(normLabel(a)).toBe(b));
});

describe('usage et pièce', () => {
  it.each([
    // Français, abréviations
    ['PRISES CUISINE', ['socket'], 'Cuisine'],
    ['PC cuis.', ['socket'], 'Cuisine'],
    ['P.C. séjour', ['socket'], 'Salon'],
    ['Ecl. ext.', ['light'], 'Extérieur'],
    ['ECL SDB', ['light'], 'Salle de bain'],
    ['Lum. hall + esc.', ['light'], undefined],
    ['Spots SàM', ['light'], 'Salle à manger'],
    ['Ch.1', [], 'Chambre 1'],
    ['Prises ch 3', ['socket'], 'Chambre 3'],
    ['Prises chambre 2', ['socket'], 'Chambre 2'],
    ['PC bureau', ['socket'], 'Bureau'],
    ['Prises buand.', ['socket'], 'Buanderie'],
    ['LL', ['appliance:washingMachine'], undefined],
    ['L-L buanderie', ['appliance:washingMachine'], 'Buanderie'],
    ['S-L', ['appliance:dryer'], undefined],
    ['LV', ['appliance:dishwasher'], undefined],
    ['Lave-vaisselle', ['appliance:dishwasher'], undefined],
    ['Taque vitro', ['appliance:hob'], undefined],
    ['Plaques de cuisson', ['appliance:hob'], undefined],
    ['Four + MO', ['appliance:oven', 'appliance:microwave'], undefined],
    ['Micro-ondes', ['appliance:microwave'], undefined],
    ['Congél. cave', ['appliance:freezer'], 'Cave'],
    ['Frigo', ['appliance:fridge'], undefined],
    ['Chauffe-eau', ['appliance:waterHeater'], undefined],
    ['Boiler', ['appliance:waterHeater'], undefined],
    ['Chaudière', ['appliance:boiler'], undefined],
    ['PAC', ['appliance:heatPump'], undefined],
    ['Pompe à chaleur', ['appliance:heatPump'], undefined],
    ['Convecteurs ch.', ['appliance:heater'], 'Chambre'],
    ['VMC', ['appliance:fan'], undefined],
    ['Hotte', ['appliance:fan'], undefined],
    ['Volets RDC', ['motor'], undefined],
    ['Porte de garage', ['motor'], 'Garage'],
    ['Pompe puits', ['motor'], undefined],
    ['Sonnette', ['bell'], undefined],
    ['Borne VE garage', ['appliance:evCharger'], 'Garage'],
    ['Sous-tableau garage', ['board'], 'Garage'],
    ['Tab. div. grenier', ['board'], 'Grenier'],
    ['Prises + éclairage garage', ['socket', 'light'], 'Garage'],
    ['PRISES II', ['socket'], undefined],
    // Néerlandais
    ['Stopcontacten keuken', ['socket'], 'Cuisine'],
    ['Stopc. badk.', ['socket'], 'Salle de bain'],
    ['Verlichting slaapkamer 2', ['light'], 'Chambre 2'],
    ['Verl. living', ['light'], 'Salon'],
    ['Licht inkom', ['light'], 'Hall'],
    ['Slpk 1 stopc.', ['socket'], 'Chambre 1'],
    ['Wasm.', ['appliance:washingMachine'], undefined],
    ['Droogkast', ['appliance:dryer'], undefined],
    ['Vaatwasser', ['appliance:dishwasher'], undefined],
    ['Kookplaat', ['appliance:hob'], undefined],
    ['Oven', ['appliance:oven'], undefined],
    ['Diepvries kelder', ['appliance:freezer'], 'Cave'],
    ['Koelkast', ['appliance:fridge'], undefined],
    ['Warmtepomp', ['appliance:heatPump'], undefined],
    ['Rolluiken', ['motor'], undefined],
    ['Garagepoort', ['motor'], undefined],
    ['Deurbel', ['bell'], undefined],
    ['Laadpaal', ['appliance:evCharger'], undefined],
    ['Onderverdeling tuinhuis', ['board'], undefined],
    ['Verlichting zolder', ['light'], 'Grenier'],
    ['Stopcontacten eetkamer', ['socket'], 'Salle à manger'],
    ['Buitenverlichting', [], undefined], // mot composé non découpé : inconnu, une question sera posée
    ['Verlichting tuin', ['light'], 'Extérieur'],
    // Anglais
    ['Kitchen sockets', ['socket'], 'Cuisine'],
    ['Lights bedroom 1', ['light'], 'Chambre 1'],
    ['Washing machine', ['appliance:washingMachine'], undefined],
    ['Heat pump', ['appliance:heatPump'], undefined],
    ['EV charger', ['appliance:evCharger'], undefined],
    ['Sub-board garage', ['board'], 'Garage'],
    // Inconnu : rien n'est deviné
    ['XYZ', [], undefined],
    ['K3', [], undefined],
    ['Divers', [], undefined],
    ['', [], undefined],
  ])('« %s »', (label, use, room) => {
    const r = interpretLabel(label);
    expect(usages(label)).toEqual(use);
    expect(r.room).toBe(room);
  });

  it('plusieurs pièces : aucune pièce unique (placer dans l’une serait inventé)', () => {
    for (const l of ['Prises ch. 1 et ch. 2', 'Ecl. ch.1+2', 'Licht living + eetk.']) {
      const r = interpretLabel(l);
      expect(r.room).toBeUndefined();
      expect(r.rooms.length).toBeGreaterThan(1);
    }
    expect(interpretLabel('Ecl. ch.1+2').rooms).toEqual(['Chambre 1', 'Chambre 2']);
  });

  it('réserve et appareil de tête : ni usage ni pièce', () => {
    for (const l of ['Réserve', 'RESERVE 3', 'Libre', 'Vrij', 'Spare']) expect(interpretLabel(l)).toMatchObject({ spare: true, usages: [] });
    for (const l of ['Général', 'Algemeen', 'Main']) expect(interpretLabel(l)).toMatchObject({ main: true, usages: [] });
    // « Prises réserve » : des prises, pas une réserve
    expect(interpretLabel('Prises réserve').spare).toBeUndefined();
    expect(usages('Prises réserve')).toEqual(['socket']);
  });

  it('un mot n’est compté qu’une fois (« pompe à chaleur » n’est pas aussi une pompe)', () => {
    expect(usages('Pompe à chaleur')).toEqual(['appliance:heatPump']);
    expect(usages('Chauffe-eau')).toEqual(['appliance:waterHeater']);
  });
});
