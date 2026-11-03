import http from 'node:http';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { signBridgeRequest } from './bridge-auth.mjs';

const SESSION_SECONDS = 7 * 24 * 60 * 60;
const MAX_BODY = 6 * 1024 * 1024;
const BODY_TIMEOUT = 10_000;
const COOKIE = '__session';
const SOURCE = new URL('.', import.meta.url);
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const REQUEST_HEADERS = new Set(['accept', 'accept-language', 'content-type', 'if-none-match', 'if-modified-since', 'range', 'if-range', 'rsc', 'next-router-state-tree', 'next-router-prefetch', 'next-url']);
const HOP_HEADERS = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'host']);

class GatewayError extends Error {
  constructor(message, status = 400, clearCookie = false) { super(message); this.status = status; this.clearCookie = clearCookie; }
}

export function safeReturnTo(value) {
  if (typeof value !== 'string' || value.length > 2000 || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return '/';
  if (/^\/(?:%2f|%5c)/i.test(value) || /%5c/i.test(value.split(/[?#]/)[0])) return '/';
  try {
    const target = new URL(value, 'https://hearth.local');
    if (target.origin !== 'https://hearth.local' || target.pathname === '/sign-in' || target.pathname.startsWith('/api/') || target.pathname === '/auth-client.js') return '/';
    return target.pathname + target.search + target.hash;
  } catch { return '/'; }
}

function origin(value, name, local = false) {
  let url;
  try { url = new URL(value); } catch { throw Error(`${name} must be a valid origin.`); }
  const localHost = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && localHost && url.protocol === 'http:')) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error(`${name} must be a secure origin without a path.`);
  return url.origin;
}

export function loadConfig(env = process.env) {
  const local = env.HEARTH_LOCAL === '1';
  let firebase;
  try { firebase = JSON.parse(env.FIREBASE_CONFIG || '{}'); } catch { throw Error('FIREBASE_CONFIG must contain public Firebase JSON.'); }
  const projectId = env.FIREBASE_PROJECT_ID || 'gen-lang-client-0444960702';
  if (!firebase.apiKey || !firebase.authDomain || !firebase.appId || firebase.projectId !== projectId) throw Error('Firebase public configuration is incomplete or belongs to another project.');
  if (!/^[A-Za-z0-9_.-]{1,200}$/.test(firebase.authDomain)) throw Error('Firebase auth domain is invalid.');
  const encodedKey = (env.HEARTH_COOKIE_SECRET || '').trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encodedKey)) throw Error('HEARTH_COOKIE_SECRET must be a base64 AES key.');
  const cookieKey = Buffer.from(encodedKey, 'base64');
  if (cookieKey.length !== 32) throw Error('HEARTH_COOKIE_SECRET must decode to exactly 32 bytes.');
  if (typeof env.HEARTH_BRIDGE_SECRET !== 'string' || env.HEARTH_BRIDGE_SECRET.length < 32) throw Error('HEARTH_BRIDGE_SECRET must be at least 32 characters.');
  const appOrigin = origin(env.APP_ORIGIN || 'https://hearth-family-plan.web.app', 'APP_ORIGIN', local);
  const upstreamOrigin = origin(env.UPSTREAM_ORIGIN || '', 'UPSTREAM_ORIGIN', local);
  if (upstreamOrigin === appOrigin) throw Error('The upstream must differ from the public application origin.');
  const canonicalOrigin = origin(env.CANONICAL_APP_ORIGIN || appOrigin, 'CANONICAL_APP_ORIGIN', local);
  const port = Number(env.PORT || 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('PORT must be between 1 and 65535.');
  return { local, firebase, projectId, cookieKey, bridgeSecret: env.HEARTH_BRIDGE_SECRET, appOrigin, canonicalOrigin, upstreamOrigin, port };
}

function publicUser(decoded) {
  if (typeof decoded.uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(decoded.uid)) throw new GatewayError('This sign-in identity is not supported.', 401, true);
  const anonymous = decoded.firebase?.sign_in_provider === 'anonymous';
  if (anonymous) return { uid: decoded.uid, email: `${decoded.uid}@demo.hearth.invalid`, name: 'Private sample', isDemo: true, emailVerified: false };
  if (decoded.email_verified !== true || typeof decoded.email !== 'string' || decoded.email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(decoded.email)) throw new GatewayError('Verify your email address before creating or sharing a real plan.', 403, true);
  const email = decoded.email.trim().toLowerCase();
  return { uid: decoded.uid, email, name: typeof decoded.name === 'string' && decoded.name.trim() ? Array.from(decoded.name.trim()).slice(0, 100).join('') : email, isDemo: false, emailVerified: true };
}

export function encryptSession(payload, config) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', config.cookieKey, iv);
  cipher.setAAD(Buffer.from(`${config.appOrigin}|hearth-session-v1`));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const value = ['v1', iv.toString('base64url'), ciphertext.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
  if (value.length > 3800) throw new GatewayError('The sign-in session is too large for a secure browser cookie. Try another sign-in method.', 400);
  return value;
}

export function decryptSession(value, config, now = Date.now()) {
  if (typeof value !== 'string' || value.length > 4000) throw new GatewayError('Your sign-in session is unavailable. Sign in again.', 401, true);
  try {
    const [version, ivText, cipherText, tagText, extra] = value.split('.');
    if (version !== 'v1' || extra || !ivText || !cipherText || !tagText || !/^[A-Za-z0-9_.-]+$/.test(value)) throw Error('format');
    const iv = Buffer.from(ivText, 'base64url'), tag = Buffer.from(tagText, 'base64url');
    if (iv.length !== 12 || tag.length !== 16) throw Error('format');
    const decipher = createDecipheriv('aes-256-gcm', config.cookieKey, iv);
    decipher.setAAD(Buffer.from(`${config.appOrigin}|hearth-session-v1`));
    decipher.setAuthTag(tag);
    const payload = JSON.parse(Buffer.concat([decipher.update(Buffer.from(cipherText, 'base64url')), decipher.final()]).toString('utf8'));
    if (typeof payload.uid !== 'string' || typeof payload.FirebaseIDToken !== 'string' || typeof payload.refreshToken !== 'string' || !Number.isSafeInteger(payload.expiresAt) || !Number.isSafeInteger(payload.createdAt) || payload.expiresAt <= now || payload.createdAt > now + 30_000 || payload.expiresAt - payload.createdAt > SESSION_SECONDS * 1000 || (payload.selectedHousehold !== null && (typeof payload.selectedHousehold !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(payload.selectedHousehold)))) throw Error('payload');
    return payload;
  } catch { throw new GatewayError('Your sign-in session expired or could not be verified. Sign in again.', 401, true); }
}

function sessionCookie(payload, config) {
  const remaining = Math.max(0, Math.min(SESSION_SECONDS, Math.ceil((payload.expiresAt - Date.now()) / 1000)));
  const secure = config.local && config.appOrigin.startsWith('http:') ? '' : '; Secure';
  return `${COOKIE}=${encryptSession(payload, config)}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=${remaining}; Expires=${new Date(payload.expiresAt).toUTCString()}`;
}
function clearSessionCookie(config) {
  return `${COOKIE}=; Path=/; HttpOnly${config.local && config.appOrigin.startsWith('http:') ? '' : '; Secure'}; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
function readCookie(request) {
  const values = (request.headers.cookie || '').split(';').map(v => v.trim()).filter(v => v.startsWith(`${COOKIE}=`));
  if (values.length > 1) throw new GatewayError('Ambiguous sign-in cookie. Sign in again.', 401, true);
  return values.length ? values[0].slice(COOKIE.length + 1) : null;
}
function checkOrigin(request, config) {
  if (request.headers.origin !== config.appOrigin) throw new GatewayError('This action must be made from the Hearth application.', 403);
  const site = request.headers['sec-fetch-site'];
  if (site && site !== 'same-origin' && site !== 'none') throw new GatewayError('Cross-site actions are rejected.', 403);
}

async function readBody(request, limit = MAX_BODY) {
  const claimed = request.headers['content-length'];
  if (claimed && (!/^\d+$/.test(claimed) || Number(claimed) > limit)) throw new GatewayError('This request is too large.', 413);
  let size = 0, chunks = [], timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new GatewayError('The request body took too long to arrive.', 408)), BODY_TIMEOUT); });
  const reading = (async () => {
    for await (const chunk of request) {
      size += chunk.length;
      if (size > limit) throw new GatewayError('This request is too large.', 413);
      chunks.push(chunk);
    }
    return Buffer.concat(chunks, size);
  })();
  try { return await Promise.race([reading, timeout]); }
  catch(error) { request.pause(); error.closeConnection = true; throw error; }
  finally { clearTimeout(timer); chunks = []; }
}
async function jsonBody(request, limit = 32_000) {
  if (!(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw new GatewayError('Expected a JSON request.', 415);
  const bytes = await readBody(request, limit);
  try { return JSON.parse(bytes.toString('utf8')); } catch { throw new GatewayError('The request is not valid JSON.'); }
}
function securityHeaders(config, authPage = false) {
  const headers = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'X-Frame-Options': 'SAMEORIGIN' };
  if (!config.local) headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  if (authPage) {
    headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' https://apis.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.googleapis.com; frame-src https://*.firebaseapp.com https://*.web.app https://accounts.google.com; base-uri 'none'; object-src 'none'; form-action 'self'; frame-ancestors 'self'";
    headers['Cross-Origin-Opener-Policy'] = 'same-origin-allow-popups';
  }
  return headers;
}
function json(response, config, status, value, cookie) {
  const text = JSON.stringify(value);
  response.writeHead(status, { ...securityHeaders(config), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) });
  response.end(text);
}
function isApi(pathname) { return pathname === '/api' || pathname.startsWith('/api/'); }
function isPublicApi(request, pathname) { return request.method === 'GET' && ['/api/evaluation', '/api/health'].includes(pathname); }

export function createGatewayServer(config, dependencies = {}) {
  const fetcher = dependencies.fetch || fetch;
  const adminApp = dependencies.verifyIdToken ? null : (getApps().find(a => a.name === 'hearth-gateway') || initializeApp({ projectId: config.projectId }, 'hearth-gateway'));
  const verifyIdToken = dependencies.verifyIdToken || (token => getAuth(adminApp).verifyIdToken(token));
  const refreshes = new Map();
  async function refresh(token) {
    const key = createHash('sha256').update(token).digest('hex');
    if (refreshes.has(key)) return refreshes.get(key);
    const promise = (async () => {
      const r = await fetcher(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(config.firebase.apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token }).toString(), signal: AbortSignal.timeout(10_000) });
      if (!r.ok) throw new GatewayError('Your sign-in expired. Sign in again to continue.', 401, true);
      let value;
      try { value = await r.json(); } catch { throw new GatewayError('Your sign-in could not be refreshed. Sign in again.', 401, true); }
      if (typeof value.id_token !== 'string' || typeof value.refresh_token !== 'string' || typeof value.user_id !== 'string') throw new GatewayError('The sign-in refresh response could not be verified.', 401, true);
      return value;
    })();
    refreshes.set(key, promise);
    try { return await promise; } finally { refreshes.delete(key); }
  }
  async function getSession(request) {
    const encrypted = readCookie(request);
    if (!encrypted) return { session: null, user: null, changed: false };
    const session = decryptSession(encrypted, config);
    let decoded, changed = false;
    try { decoded = await verifyIdToken(session.FirebaseIDToken); }
    catch (error) {
      if (error?.code !== 'auth/id-token-expired') throw new GatewayError('Your sign-in session could not be verified. Sign in again.', 401, true);
      const fresh = await refresh(session.refreshToken);
      if (fresh.user_id !== session.uid) throw new GatewayError('The refreshed sign-in does not match this session.', 401, true);
      try { decoded = await verifyIdToken(fresh.id_token); } catch { throw new GatewayError('The refreshed sign-in could not be verified.', 401, true); }
      session.FirebaseIDToken = fresh.id_token;
      session.refreshToken = fresh.refresh_token;
      changed = true;
    }
    if (decoded.uid !== session.uid) throw new GatewayError('The sign-in identity changed. Sign in again.', 401, true);
    return { session, user: publicUser(decoded), changed };
  }

  async function handle(request, response) {
    let context = null;
    try {
      if (!request.url || !request.url.startsWith('/') || request.url.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(request.url) || /^\/(?:%2f|%5c)/i.test(request.url) || /%5c/i.test(request.url.split('?')[0])) throw new GatewayError('Invalid request path.');
      const url = new URL(request.url, config.appOrigin);
      if (url.origin !== config.appOrigin) throw new GatewayError('Invalid request origin.');
      if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(request.method)) throw new GatewayError('Method not allowed.', 405);
      if (url.pathname === '/health' || url.pathname === '/api/health') {
        if (!['GET', 'HEAD', 'POST'].includes(request.method)) throw new GatewayError('Method not allowed.', 405);
        json(response, config, 200, { ok: true, service: 'hearth-gateway' }); return;
      }
      if (config.local && process.env.HEARTH_REVIEW_STUDIO_ROOT && request.method === 'GET') {
        const files = { '/review-studio': ['studio.html', 'text/html; charset=utf-8'], '/review-media/narration.wav': ['narration.wav', 'audio/wav'], '/review-media/timeline.json': ['timeline.json', 'application/json'], '/review-media/html2canvas.min.js': ['html2canvas.min.js', 'text/javascript; charset=utf-8'] };
        const item = files[url.pathname];
        if (item) {
          const root = new URL('file://' + process.env.HEARTH_REVIEW_STUDIO_ROOT.replace(/\/$/, '') + '/');
          const bytes = await readFile(new URL(item[0], root));
          response.writeHead(200, { ...securityHeaders(config), 'Content-Type': item[1], 'Content-Length': bytes.length, 'Cache-Control': 'no-store' }); response.end(bytes); return;
        }
      }
      if (WRITE_METHODS.has(request.method)) checkOrigin(request, config);
      if (url.pathname === '/sign-in') {
        if (!['GET', 'HEAD'].includes(request.method)) throw new GatewayError('Method not allowed.', 405);
        const returnTo = safeReturnTo(url.searchParams.get('return_to'));
        const source = await readFile(new URL('auth.html', SOURCE), 'utf8');
        const publicConfig = JSON.stringify({ firebase: config.firebase, returnTo }).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
        const html = source.replace('__HEARTH_AUTH_CONFIG__', publicConfig);
        response.writeHead(200, { ...securityHeaders(config, true), 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(request.method === 'HEAD' ? undefined : html); return;
      }
      if (url.pathname === '/auth-client.js') {
        if (!['GET', 'HEAD'].includes(request.method)) throw new GatewayError('Method not allowed.', 405);
        const client = await readFile(new URL('dist/auth-client.js', SOURCE));
        response.writeHead(200, { ...securityHeaders(config), 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
        response.end(request.method === 'HEAD' ? undefined : client); return;
      }
      if (url.pathname === '/api/auth/session') {
        if (request.method !== 'POST') throw new GatewayError('Method not allowed.', 405);
        const payload = await jsonBody(request);
        if (typeof payload.idToken !== 'string' || payload.idToken.length > 16_000 || typeof payload.refreshToken !== 'string' || payload.refreshToken.length < 10 || payload.refreshToken.length > 6000) throw new GatewayError('Complete the sign-in flow before creating a session.');
        let initial;
        try { initial = await verifyIdToken(payload.idToken); } catch { throw new GatewayError('The sign-in token could not be verified. Try signing in again.', 401, true); }
        publicUser(initial);
        const fresh = await refresh(payload.refreshToken);
        if (fresh.user_id !== initial.uid) throw new GatewayError('The sign-in and refresh token belong to different users.', 401, true);
        let final;
        try { final = await verifyIdToken(fresh.id_token); } catch { throw new GatewayError('The refreshed identity could not be verified.', 401, true); }
        if (final.uid !== initial.uid) throw new GatewayError('The refreshed identity does not match the sign-in.', 401, true);
        const user = publicUser(final), now = Date.now();
        const session = { FirebaseIDToken: fresh.id_token, refreshToken: fresh.refresh_token, uid: final.uid, selectedHousehold: null, createdAt: now, expiresAt: now + SESSION_SECONDS * 1000 };
        json(response, config, 200, { ok: true, user }, sessionCookie(session, config)); return;
      }
      if (url.pathname === '/api/auth/sign-out') {
        if (request.method !== 'POST') throw new GatewayError('Method not allowed.', 405);
        json(response, config, 200, { ok: true }, clearSessionCookie(config)); return;
      }
      if (url.pathname === '/api/auth/status') {
        if (request.method !== 'GET') throw new GatewayError('Method not allowed.', 405);
        try { context = await getSession(request); }
        catch (error) { if (error.status === 401 || error.status === 403) { json(response, config, 200, { configured: true, user: null }, clearSessionCookie(config)); return; } throw error; }
        json(response, config, 200, { configured: true, user: context.user }, context.changed ? sessionCookie(context.session, config) : undefined); return;
      }
      if (url.pathname.startsWith('/api/auth/')) throw new GatewayError('Authentication route not found.', 404);
      try { context = await getSession(request); }
      catch (error) {
        if (isApi(url.pathname) && !isPublicApi(request, url.pathname)) throw error;
        context = { session: null, user: null, changed: false };
        response.setHeader('Set-Cookie', clearSessionCookie(config));
      }
      if (((isApi(url.pathname) && !isPublicApi(request, url.pathname)) || WRITE_METHODS.has(request.method)) && !context.user) throw new GatewayError('Sign in to open your private workspace.', 401, true);
      if (request.method === 'OPTIONS') { response.writeHead(204, { ...securityHeaders(config), 'Cache-Control': 'no-store', Allow: 'GET, HEAD, POST, PUT, PATCH, DELETE' }); response.end(); return; }
      const bytes = request.method === 'GET' || request.method === 'HEAD' ? Buffer.alloc(0) : await readBody(request);
      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers)) {
        const lower = name.toLowerCase();
        if (!REQUEST_HEADERS.has(lower) || HOP_HEADERS.has(lower) || lower.startsWith('oai-') || lower.startsWith('x-hearth-') || value === undefined) continue;
        headers.set(lower, Array.isArray(value) ? value.join(', ') : value);
      }
      if (context.session?.selectedHousehold) headers.set('Cookie', `hearth_household=${context.session.selectedHousehold}`);
      if (WRITE_METHODS.has(request.method)) headers.set('Origin', config.canonicalOrigin);
      const upstreamUrl = new URL(url.pathname + url.search, config.upstreamOrigin);
      if (upstreamUrl.origin !== config.upstreamOrigin) throw new GatewayError('Invalid upstream path.');
      let upstreamRequest = new Request(upstreamUrl, { method: request.method, headers, ...(bytes.length ? { body: bytes } : {}) });
      if (context.user) {
        const assertion = await signBridgeRequest(upstreamRequest, new Uint8Array(bytes), context.user, config.bridgeSecret);
        const signedHeaders = new Headers(headers);
        for (const [name, value] of Object.entries(assertion)) signedHeaders.set(name, value);
        upstreamRequest = new Request(upstreamRequest, { headers: signedHeaders });
      }
      const upstream = await fetcher(upstreamRequest, { redirect: 'manual', signal: AbortSignal.timeout(180_000) });
      const outgoing = new Headers(upstream.headers);
      const upstreamCookies = typeof upstream.headers.getSetCookie === 'function' ? upstream.headers.getSetCookie() : [upstream.headers.get('set-cookie') || ''];
      if (context.session) {
        for (const item of upstreamCookies) {
          const match = /^hearth_household=([^;]*)/i.exec(item);
          if (!match) continue;
          const selected = match[1];
          if (selected && !/^[A-Za-z0-9_-]{1,128}$/.test(selected)) throw new GatewayError('The selected workspace identifier is invalid.', 502);
          context.session.selectedHousehold = selected || null;
          context.changed = true;
        }
      }
      for (const name of [...outgoing.keys()]) {
        if (HOP_HEADERS.has(name.toLowerCase()) || name.toLowerCase() === 'set-cookie' || name.toLowerCase() === 'content-length' || name.toLowerCase() === 'content-encoding' || name.toLowerCase().startsWith('oai-') || name.toLowerCase().startsWith('x-hearth-')) outgoing.delete(name);
      }
      const location = outgoing.get('location');
      if (location) {
        try { const redirected = new URL(location, config.upstreamOrigin); if (redirected.origin === config.upstreamOrigin) outgoing.set('Location', config.appOrigin + redirected.pathname + redirected.search + redirected.hash); } catch { outgoing.delete('location'); }
      }
      for (const [name, value] of Object.entries(securityHeaders(config))) outgoing.set(name, value);
      if (isApi(url.pathname) || context.user) outgoing.set('Cache-Control', 'no-store');
      if (context.changed) outgoing.set('Set-Cookie', sessionCookie(context.session, config));
      response.writeHead(upstream.status, Object.fromEntries(outgoing.entries()));
      if (request.method === 'HEAD' || !upstream.body) { response.end(); return; }
      await pipeline(Readable.fromWeb(upstream.body), response);
    } catch (error) {
      if (response.headersSent) { response.destroy(); return; }
      if (error?.closeConnection) { response.setHeader('Connection', 'close'); response.once('finish', () => request.destroy()); }
      const status = error instanceof GatewayError ? error.status : error?.name === 'TimeoutError' ? 504 : 502;
      const message = error instanceof GatewayError ? error.message : status === 504 ? 'The service is taking longer than expected. Please try again.' : 'The service is temporarily unavailable. Please try again.';
      json(response, config, status, { error: message }, error?.clearCookie ? clearSessionCookie(config) : undefined);
    }
  }
  const server = http.createServer((request, response) => { void handle(request, response); });
  server.requestTimeout = 190_000;
  server.headersTimeout = 15_000;
  server.keepAliveTimeout = 5000;
  server.on('clientError', (_, socket) => { if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); });
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(process.argv[1], 'file:'))) {
  try {
    const config = loadConfig();
    createGatewayServer(config).listen(config.port, config.local ? '127.0.0.1' : '0.0.0.0', () => { console.log('Hearth gateway is ready.'); });
  } catch { console.error('Hearth gateway configuration is incomplete or invalid.'); process.exitCode = 1; }
}
