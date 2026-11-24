/**
 * Nettoyage d'un projet ouvert depuis un fichier ou un service distant : les images (fonds de plan,
 * meubles Trikker, photos de tableau) ne peuvent être que des images intégrées (data:image/…) ou, depuis le
 * format v2, des références à un document rangé à part : « asset:<sha256> » (64 chiffres hexadécimaux, résolues
 * uniquement dans l'archive, le dossier du projet ou le stockage de travail ; jamais une adresse).
 * Toute autre adresse (http:, javascript:, file:…) est retirée : elle pourrait faire charger une
 * ressource externe (suivi, fuite d'information) ou servir de vecteur d'attaque.
 */
import type { Project } from '../model/types';

/** Image intégrée : data:image/<type>[;paramètres][;base64],<données>. */
const SAFE_IMAGE = /^data:image\/[a-z0-9.+-]+(;[a-z0-9=.+-]+)*(;base64)?,/i;

/** Référence de document du format v2. */
const ASSET_REF = /^asset:[0-9a-f]{64}$/;

export function isSafeImageHref(href: unknown): href is string {
  return typeof href === 'string' && (SAFE_IMAGE.test(href) || ASSET_REF.test(href));
}

/** Retire les images dont l'adresse n'est pas sûre ; renvoie le nombre d'images retirées. */
export function sanitizeProjectImages(project: Project): number {
  let removed = 0;
  for (const page of project.plan?.pages ?? []) {
    if (!Array.isArray(page.images)) continue;
    const kept = page.images.filter((im) => isSafeImageHref(im?.href));
    removed += page.images.length - kept.length;
    page.images = kept;
  }
  for (const layout of Object.values(project.boards ?? {})) {
    if (layout?.photo && !isSafeImageHref(layout.photo.href)) {
      delete layout.photo;
      removed++;
    }
  }
  return removed;
}
