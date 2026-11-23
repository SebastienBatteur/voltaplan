import { asciiJson, pkcePair } from '../src/io/cloud';

describe('stockage en ligne (Drive, OneDrive, Dropbox)', () => {
  it('PKCE : vérificateur et défi au format base64url (RFC 7636)', async () => {
    const { verifier, challenge } = await pkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it('en-tête Dropbox en ASCII', () => {
    expect(asciiJson({ path: '/Électricité.voltaplan' })).toBe(String.raw`{"path":"/\u00c9lectricit\u00e9.voltaplan"}`);
  });
});
