import test from 'node:test';
import assert from 'node:assert/strict';
import { createGatewayServer, encryptSession, decryptSession, safeReturnTo } from '../gateway/server.mjs';
import { verifyBridgeRequest } from '../gateway/bridge-auth.mjs';

const real = { uid: 'synthetic_user', email: 'synthetic@example.invalid', email_verified: true, name: 'Alex', firebase: { sign_in_provider: 'password' } };
const anonymous = { uid: 'synthetic_guest', firebase: { sign_in_provider: 'anonymous' } };
const config = { local: true, appOrigin: 'http://localhost', canonicalOrigin: 'https://canonical.example.invalid', upstreamOrigin: 'https://upstream.example.invalid', projectId: 'synthetic', firebase: { apiKey: 'fake-public-key' }, cookieKey: Buffer.alloc(32, 7), bridgeSecret: 'synthetic-bridge-secret-never-used-in-production' };
function session(overrides = {}) { const now = Date.now(); return { uid: real.uid, FirebaseIDToken: 'valid', refreshToken: 'synthetic-refresh-token', selectedHousehold: null, createdAt: now, expiresAt: now + 3600000, ...overrides }; }
function cookie(value) { return `__session=${encryptSession(value, config)}`; }
function fromCookie(response) { return decryptSession(response.headers.get('set-cookie').split(';')[0].slice('__session='.length), config); }
async function fixture(t, options = {}) {
  const calls = [];
  const server = createGatewayServer(config, {
    verifyIdToken: options.verify || (async token => { if (token === 'expired') throw Object.assign(Error('expired'), { code: 'auth/id-token-expired' }); return token === 'guest' ? anonymous : real; }),
    fetch: async (request, init) => {
      if (typeof request === 'string') { calls.push({ refresh: request, init }); return Response.json(options.refresh || { user_id: real.uid, id_token: 'fresh', refresh_token: 'synthetic-fresh-refresh-token' }); }
      calls.push({ request, init });
      return options.upstream ? options.upstream(request, init) : Response.json({ ok: true });
    },
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = (path, init = {}) => fetch(base + path, { ...init, redirect: 'manual' });
  return { send, calls };
}

test('session encryption rejects tampering, expiry, and another origin', () => {
  const value = encryptSession(session(), config);
  assert.equal(decryptSession(value, config).uid, real.uid);
  const parts = value.split('.'); parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1);
  assert.throws(() => decryptSession(parts.join('.'), config));
  assert.throws(() => decryptSession(value, { ...config, appOrigin: 'https://other.example.invalid' }));
  assert.throws(() => decryptSession(value, config, Date.now() + 7200000));
});

test('private API ignores forged identity without encrypted session; public evaluation is no-store', async t => {
  const { send, calls } = await fixture(t);
  const denied = await send('/api/workspace', { headers: { 'oai-authenticated-user-id': 'operator', 'x-hearth-bridge-verified': '1', authorization: 'Bearer fake' } });
  assert.equal(denied.status, 401); assert.equal(calls.length, 0);
  const result = await send('/api/evaluation'); assert.equal(result.status, 200); assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal(calls[0].request.headers.has('x-hearth-signature'), false);
});

test('authenticated proxy signs exact identity/body and strips client credentials and selected household cookie', async t => {
  const { send, calls } = await fixture(t);
  const result = await send('/api/workspace?x=1', { method: 'POST', headers: { origin: config.appOrigin, cookie: cookie(session()) + '; hearth_household=attacker', authorization: 'Bearer attacker', 'oai-authenticated-user-email': 'attacker@example.invalid', 'x-hearth-bridge-demo': '1', 'content-type': 'application/json' }, body: '{"action":"synthetic"}' });
  assert.equal(result.status, 200); const upstream = calls[0].request;
  assert.equal(upstream.url, config.upstreamOrigin + '/api/workspace?x=1');
  for (const name of ['authorization', 'oai-authenticated-user-email', 'x-hearth-bridge-demo', 'cookie']) assert.equal(upstream.headers.has(name), false, name);
  assert.equal(upstream.headers.get('origin'), config.canonicalOrigin);
  const identity = await verifyBridgeRequest(upstream, config.bridgeSecret); assert.equal(identity.uid, real.uid); assert.equal(identity.isDemo, false);
  assert.equal(await upstream.text(), '{"action":"synthetic"}'); assert.equal(result.headers.get('cache-control'), 'no-store');
});

test('cross-origin writes fail before proxy or token refresh', async t => {
  const { send, calls } = await fixture(t);
  for (const origin of [undefined, 'https://attacker.example.invalid']) {
    const result = await send('/api/workspace', { method: 'POST', headers: { ...(origin ? { origin } : {}), cookie: cookie(session()) }, body: 'fake' }); assert.equal(result.status, 403);
  }
  const crossSite = await send('/api/workspace', { method: 'POST', headers: { origin: config.appOrigin, 'sec-fetch-site': 'cross-site', cookie: cookie(session()) }, body: 'fake' }); assert.equal(crossSite.status, 403); assert.equal(calls.length, 0);
});

test('session UID mismatch and unverified real email never reach upstream', async t => {
  const { send, calls } = await fixture(t);
  assert.equal((await send('/api/workspace', { headers: { cookie: cookie(session({ uid: 'another_user' })) } })).status, 401); assert.equal(calls.length, 0);
  const unverified = await fixture(t, { verify: async () => ({ ...real, email_verified: false }) });
  assert.equal((await unverified.send('/api/workspace', { headers: { cookie: cookie(session()) } })).status, 403); assert.equal(unverified.calls.length, 0);
});

test('anonymous Firebase user receives signed reserved sample identity', async t => {
  const { send, calls } = await fixture(t);
  assert.equal((await send('/api/workspace', { headers: { cookie: cookie(session({ uid: anonymous.uid, FirebaseIDToken: 'guest' })) } })).status, 200);
  const identity = await verifyBridgeRequest(calls[0].request, config.bridgeSecret);
  assert.equal(identity.email, anonymous.uid + '@demo.hearth.invalid'); assert.equal(identity.isDemo, true); assert.equal(identity.emailVerified, false);
});

test('selected household is intercepted into authenticated envelope and only that cookie is forwarded', async t => {
  const { send, calls } = await fixture(t, { upstream: () => Response.json({}, { headers: { 'set-cookie': 'hearth_household=chosen_synthetic; Path=/; HttpOnly' } }) });
  const response = await send('/api/workspace', { headers: { cookie: cookie(session()) } });
  const changed = fromCookie(response); assert.equal(changed.selectedHousehold, 'chosen_synthetic');
  assert.match(response.headers.get('set-cookie'), /HttpOnly/); assert.doesNotMatch(response.headers.get('set-cookie'), /^hearth_household=/);
  await send('/api/workspace', { headers: { cookie: cookie(changed) + '; hearth_household=attacker' } });
  assert.equal(calls[1].request.headers.get('cookie'), 'hearth_household=chosen_synthetic');
});

test('refresh preserves fixed expiry and rejects switched refresh user', async t => {
  const original = session({ FirebaseIDToken: 'expired', selectedHousehold: 'chosen_synthetic' });
  const { send, calls } = await fixture(t);
  const response = await send('/api/workspace', { headers: { cookie: cookie(original) } }); assert.equal(response.status, 200);
  const changed = fromCookie(response); assert.equal(changed.expiresAt, original.expiresAt); assert.equal(changed.createdAt, original.createdAt); assert.equal(changed.selectedHousehold, original.selectedHousehold); assert.equal(changed.FirebaseIDToken, 'fresh');
  assert.equal(calls.filter(c => c.refresh).length, 1);
  const switched = await fixture(t, { refresh: { user_id: 'another_user', id_token: 'fresh', refresh_token: 'synthetic-other-refresh-token' } });
  assert.equal((await switched.send('/api/workspace', { headers: { cookie: cookie(original) } })).status, 401); assert.equal(switched.calls.some(c => c.request), false);
});

test('session exchange binds ID and refresh identity and applies secure cookie properties', async t => {
  const { send } = await fixture(t);
  const response = await send('/api/auth/session', { method: 'POST', headers: { origin: config.appOrigin, 'content-type': 'application/json' }, body: JSON.stringify({ idToken: 'valid', refreshToken: 'synthetic-refresh-token' }) });
  assert.equal(response.status, 200); const value = fromCookie(response); assert.equal(value.uid, real.uid); assert.equal(value.expiresAt - value.createdAt, 7 * 86400000); assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/); assert.equal(response.headers.get('cache-control'), 'no-store');
  const switched = await fixture(t, { refresh: { user_id: 'another_user', id_token: 'fresh', refresh_token: 'synthetic-other-refresh-token' } });
  assert.equal((await switched.send('/api/auth/session', { method: 'POST', headers: { origin: config.appOrigin, 'content-type': 'application/json' }, body: JSON.stringify({ idToken: 'valid', refreshToken: 'synthetic-refresh-token' }) })).status, 401);
});

test('upstream redirects are never followed and internal location is rewritten', async t => {
  const { send, calls } = await fixture(t, { upstream: () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data', 'set-cookie': 'evil=secret', 'x-hearth-private': 'secret' } }) });
  const response = await send('/evaluation'); assert.equal(response.status, 302); assert.equal(calls.length, 1); assert.equal(calls[0].init.redirect, 'manual'); assert.equal(response.headers.has('set-cookie'), false); assert.equal(response.headers.has('x-hearth-private'), false);
  const internal = await fixture(t, { upstream: () => new Response(null, { status: 302, headers: { location: config.upstreamOrigin + '/evaluation?q=1' } }) });
  assert.equal((await internal.send('/evaluation')).headers.get('location'), config.appOrigin + '/evaluation?q=1');
});

test('return destinations reject external, auth API and encoded slash escapes', () => {
  for (const path of ['//attacker.invalid', '/\\attacker.invalid', '/%2fattacker.invalid', '/api/workspace', '/sign-in', 'https://attacker.invalid']) assert.equal(safeReturnTo(path), '/');
  assert.equal(safeReturnTo('/evaluation?mode=synthetic#results'), '/evaluation?mode=synthetic#results');
});

test('non-BMP display names remain valid Unicode across gateway and bridge', async t => {
  const name = 'A'.repeat(99) + '😀' + 'tail';
  const { send, calls } = await fixture(t, { verify: async () => ({ ...real, name }) });
  assert.equal((await send('/api/workspace', { headers: { cookie: cookie(session()) } })).status, 200);
  const identity = await verifyBridgeRequest(calls[0].request, config.bridgeSecret); assert.equal(identity.name, 'A'.repeat(99) + '😀'); assert.doesNotThrow(() => encodeURIComponent(identity.name));
});
