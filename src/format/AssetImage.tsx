/**
 * Affichage d'une image du projet dans un dessin SVG : image intégrée (`data:`) telle quelle, référence
 * « asset:<sha256> » résolue en URL d'objet de l'image d'affichage (src/format/session.ts). Document indisponible
 * (fichier déplacé, manquant, invalide) : cadre hachuré avec une info-bulle, jamais d'erreur bloquante.
 */
import { useEffect, useState, type SVGProps } from 'react';
import { ASSET_SCHEME } from './manifest';
import { assetSession } from '../io/projectData';
import { useStore } from '../store';

type State = { url: string } | { error: string } | null;

/** Adresse affichable d'une image du projet (undefined pendant le chargement). */
export function useAssetUrl(href: string | undefined): State {
  const direct = !href || !href.startsWith(ASSET_SCHEME);
  const [state, setState] = useState<State>(direct && href ? { url: href } : null);
  useEffect(() => {
    if (!href) return setState(null);
    if (!href.startsWith(ASSET_SCHEME)) return setState({ url: href });
    let alive = true;
    setState(null);
    assetSession
      .displayUrl(href)
      .then((url) => alive && setState({ url }))
      .catch((e: Error & { reason?: string }) => alive && setState({ error: e.reason ?? 'missing' }));
    return () => {
      alive = false;
    };
  }, [href]);
  return state;
}

/** `<image>` SVG dont l'adresse peut être une référence de document. */
export function AssetImage({ href, ...rest }: SVGProps<SVGImageElement> & { href: string }) {
  const s = useAssetUrl(href);
  const t = useStore((st) => st.t);
  if (s && 'url' in s) return <image href={s.url} {...rest} />;
  const x = Number(rest.x ?? 0);
  const y = Number(rest.y ?? 0);
  // Chargement ou document indisponible : emplacement visible (même taille, même transformation)
  return (
    <g transform={rest.transform} style={{ pointerEvents: 'none' }} data-asset-missing={s && 'error' in s ? s.error : 'loading'}>
      <rect x={x} y={y} width={rest.width} height={rest.height} fill="none" stroke="#c0392b" strokeDasharray="40 20" strokeWidth={4} opacity={s ? 0.8 : 0.2}>
        {s && 'error' in s && <title>{t('format.docUnavailable.' + s.error)}</title>}
      </rect>
    </g>
  );
}
