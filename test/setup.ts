/**
 * Environnement de test jsdom : son `Blob` n'a ni `arrayBuffer()` ni `text()` ni `stream()`, et ne reconnaît pas
 * les tableaux d'octets ni les `Blob` de Node (`fetch`, `Response`), qu'il convertit en texte « [object …] ». Les
 * navigateurs visés n'ont pas ces limites : on utilise donc le `Blob` de Node, complet, dans tous les tests.
 */
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';

if (typeof window !== 'undefined') {
  (globalThis as { Blob: unknown }).Blob = NodeBlob;
  (globalThis as { File: unknown }).File = NodeFile;
}
