import { FURNITURE, FURNITURE_GROUPS, FurnitureShape, type FurnitureKind } from './furniture';

/**
 * Catalogue du mobilier, le même partout : menu « Mobilier » de la barre du plan et palette « Éléments ».
 * Groupes (séjour, chambres…) avec leurs pictogrammes ; `only` : meubles à montrer (résultat d'une recherche).
 */
export function FurnitureCatalog({
  t,
  active,
  onPick,
  only,
}: {
  t: (k: string) => string;
  active?: FurnitureKind | null;
  onPick: (k: FurnitureKind) => void;
  only?: Set<FurnitureKind>;
}) {
  return (
    <>
      {FURNITURE_GROUPS.map((g) => {
        const kinds = (Object.keys(FURNITURE) as FurnitureKind[]).filter((k) => FURNITURE[k].group === g && (!only || only.has(k)));
        if (!kinds.length) return null;
        return (
          <div key={g}>
            <div className="catalog-group">{t('furniture.group.' + g)}</div>
            <div className="catalog-items">
              {kinds.map((k) => {
                const d = FURNITURE[k];
                const box = Math.max(d.w, d.h) * 1.1;
                return (
                  <button key={k} title={t('furniture.' + k)} className={active === k ? 'active' : ''} onClick={() => onPick(k)}>
                    <svg viewBox={`${-box / 2} ${-box / 2} ${box} ${box}`} className="catalog-icon" aria-hidden>
                      <FurnitureShape kind={k} w={d.w} h={d.h} />
                    </svg>
                    <span>{t('furniture.' + k)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
