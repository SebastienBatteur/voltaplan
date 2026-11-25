import { useEffect, useState } from 'react';

/** Durée d'appui (ms) avant d'afficher l'explication ; déplacement toléré (px). */
export const HELP_PRESS_MS = 500;
const MOVE_TOL = 8;
const SHOW_MS = 3000;

/**
 * Au doigt ou au stylet, les infobulles (`title`) ne s'affichent jamais : un appui long sur un bouton ou un champ qui
 * en a une montre son explication dans une bulle (audit visuel du 2026-11-25). Le relâchement qui suit ne déclenche
 * pas l'action. Rien à la souris (l'infobulle du navigateur suffit), rien sur le dessin (l'appui long y ouvre le menu
 * « Ajouter » ou déplace la vue).
 */
export function TouchHelp() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    let timer = 0;
    let hide = 0;
    let start: { x: number; y: number } | null = null;
    let shown = false;
    const cancel = () => {
      window.clearTimeout(timer);
      start = null;
    };
    const down = (e: PointerEvent) => {
      cancel();
      if (e.pointerType === 'mouse') return;
      const el = (e.target as Element | null)?.closest?.<HTMLElement>('[title]');
      if (!el || !el.title.trim() || el.closest('svg')) return;
      start = { x: e.clientX, y: e.clientY };
      shown = false;
      timer = window.setTimeout(() => {
        const r = el.getBoundingClientRect();
        shown = true;
        window.clearTimeout(hide);
        setTip({ text: el.title, x: r.left + r.width / 2, y: r.top });
      }, HELP_PRESS_MS);
    };
    const move = (e: PointerEvent) => {
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_TOL) cancel();
    };
    const up = () => {
      cancel();
      if (!shown) return;
      shown = false;
      // Le clic qui suit le relâchement n'exécute pas l'action : on voulait seulement lire l'explication
      const swallow = (ev: Event) => {
        ev.preventDefault();
        ev.stopPropagation();
      };
      window.addEventListener('click', swallow, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener('click', swallow, true), 400);
      hide = window.setTimeout(() => setTip(null), SHOW_MS);
    };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
    window.addEventListener('scroll', cancel, true);
    return () => {
      cancel();
      window.clearTimeout(hide);
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('scroll', cancel, true);
    };
  }, []);

  if (!tip) return null;
  // Reste dans l'écran : centrée sur le bouton, au-dessus (en dessous s'il est tout en haut)
  const half = Math.min(160, window.innerWidth / 2 - 8);
  const left = Math.min(Math.max(tip.x, half + 8), window.innerWidth - half - 8);
  const above = tip.y > 80;
  return (
    <div className={'touch-tip' + (above ? '' : ' below')} role="tooltip" style={{ left, top: above ? tip.y - 6 : tip.y + 50, maxWidth: 2 * half }} onClick={() => setTip(null)}>
      {tip.text}
    </div>
  );
}
