import { createContext, useContext, type AriaRole, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Avis (fin d'import, brouillon retrouvé, nouvelle version, conflit, reprise…) : tous dans une seule bande, sous le
 * dessin et au-dessus du pied de page (`.notices`, App.tsx). Audit visuel du 2026-11-25 et écart O6 : auparavant,
 * chaque avis flottait en bas à droite, ils se recouvraient entre eux, cachaient le dessin et un bouton de la boîte
 * de conflit. Dans le flux, le dessin se réduit au lieu d'être caché, et les fenêtres restent au-dessus.
 */
export const NoticeHost = createContext<HTMLElement | null>(null);

export function Notice({ children, role, onClick, line }: { children: ReactNode; role?: AriaRole; onClick?: () => void; line?: boolean }) {
  const host = useContext(NoticeHost);
  const el = (
    <div className={'toast' + (line ? ' notice-line' : '')} role={role} onClick={onClick}>
      {children}
    </div>
  );
  return host ? createPortal(el, host) : el;
}
