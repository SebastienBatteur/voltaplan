/** Débit du SHA-256 incrémental (JavaScript) comparé à Web Crypto : npx vite-node tools/perf-v2/sha-bench.ts */
import { Sha256 } from '../../src/format/sha256';

const buf = new Uint8Array(40 * 1024 * 1024);
for (let i = 0; i < buf.length; i += 4096) buf[i] = i & 0xff;
let t = performance.now();
const h = new Sha256();
for (let i = 0; i < buf.length; i += 4 * 1024 * 1024) h.update(buf.subarray(i, i + 4 * 1024 * 1024));
const js = h.digestHex();
const jsMs = performance.now() - t;
t = performance.now();
const sub = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf)), (b) => b.toString(16).padStart(2, '0')).join('');
const subMs = performance.now() - t;
console.log(`JS : ${Math.round(jsMs)} ms (${Math.round(40 / (jsMs / 1000))} Mo/s) ; Web Crypto : ${Math.round(subMs)} ms ; identiques : ${js === sub}`);
