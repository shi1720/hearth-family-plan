import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import { verifyBridgeRequest } from "../gateway/bridge-auth.mjs";
import { discardRejectedBody } from "../lib/rejected-body";

const worker = {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    const headers = new Headers(request.headers);
    let verifiedBridge = false;
    for (const name of ['x-hearth-bridge-demo', 'x-hearth-bridge-verified', 'x-hearth-display-name']) headers.delete(name);
    if (headers.has('x-hearth-identity')) {
      try {
        const user = await verifyBridgeRequest(request, (env as any).HEARTH_BRIDGE_SECRET);
        verifiedBridge = true;
        headers.set('oai-authenticated-user-id', `firebase:${user.uid}`);
        headers.set('oai-authenticated-user-email', user.email);
        headers.set('x-hearth-display-name', encodeURIComponent(user.name || user.email));
        headers.set('x-hearth-bridge-verified', '1');
        headers.set('x-hearth-bridge-demo', user.isDemo ? '1' : '0');
        const canonical = new URL(request.url);
        const appOrigin = (env as any).PUBLIC_APP_URL;
        if (appOrigin) {
          const publicUrl = new URL(canonical.pathname + canonical.search, appOrigin);
          request = new Request(publicUrl, new Request(request, { headers }));
        } else request = new Request(request, { headers });
      } catch {
        await discardRejectedBody(request, 300000);
        return Response.json({ error: 'This sign-in assertion is invalid or expired. Sign in again.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
      }
    } else request = new Request(request, { headers });
    const url = new URL(request.url);
    const publicEvaluation = request.method === 'GET' && url.pathname === '/api/evaluation';
    if ((env as any).HEARTH_REQUIRE_BRIDGE === '1' && url.pathname.startsWith('/api/') && !publicEvaluation && !verifiedBridge) {
      await discardRejectedBody(request, 300000);
      return Response.json({ error: 'Sign in to open your private family workspace.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
};

export default worker;
