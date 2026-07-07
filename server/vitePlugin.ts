import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { detectSfCli } from './sfCli/detect';
import { listOrgs, loginOrg, cancelLogin, logoutOrg } from './sfCli/orgs';
import { validateFiles, deployFiles } from './sfCli/deploy';
import type { DeployRequest, LoginRequest, CancelRequest, LogoutRequest } from './apiTypes';

const MAX_BODY_BYTES = 25 * 1024 * 1024; // profiles/permission sets can be several MB of XML

class BodyTooLargeError extends Error {}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw new BodyTooLargeError();
    chunks.push(chunk);
  }
  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(payload);
}

/**
 * Dev-only local API the frontend calls to detect/manage the Salesforce CLI and run validate/
 * deploy against a connected org. Registered directly inside configureServer() (not returned as a
 * deferred post-hook) so these routes run *before* Vite's SPA-history-fallback middleware —
 * otherwise an unmatched GET would get served index.html instead of a real response, which would
 * make the frontend's "is the backend even here" detection lie.
 *
 * Intentionally has no configurePreviewServer counterpart: `npm run preview` (and any static host
 * serving the production build) behaves like a plain static host with respect to these routes —
 * the frontend's detectSfCli() treats that identically to "CLI not installed" (see CLAUDE.md).
 */
export function sfCliDevPlugin(): Plugin {
  return {
    name: 'sf-cli-dev-plugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/sf', (req, res, next) => {
        void handleRequest(req, res, next);
      });
    },
  };
}

async function handleRequest(req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> {
  const url = req.url ?? '';
  const method = req.method ?? 'GET';

  try {
    if (method === 'GET' && url === '/detect') {
      sendJson(res, 200, await detectSfCli());
      return;
    }

    if (method === 'GET' && url === '/orgs') {
      sendJson(res, 200, await listOrgs());
      return;
    }

    if (method === 'POST' && url === '/login') {
      const body = (await readJsonBody(req)) as LoginRequest;
      sendJson(res, 200, await loginOrg(body.requestId, body.alias));
      return;
    }

    if (method === 'POST' && url === '/login/cancel') {
      const body = (await readJsonBody(req)) as CancelRequest;
      sendJson(res, 200, { acknowledged: cancelLogin(body.requestId) });
      return;
    }

    if (method === 'POST' && url === '/logout') {
      const body = (await readJsonBody(req)) as LogoutRequest;
      sendJson(res, 200, await logoutOrg(body.username));
      return;
    }

    if (method === 'POST' && (url === '/validate' || url === '/deploy')) {
      const body = (await readJsonBody(req)) as DeployRequest;
      const isDeploy = url === '/deploy';

      if (isDeploy) {
        // Defense-in-depth re-check (not a security boundary — a guard against a stale org list
        // across tabs), independent of whatever the frontend already confirmed.
        const { orgs } = await listOrgs();
        const target = orgs.find((o) => o.username === body.targetOrg || o.alias === body.targetOrg);
        if (target?.likelyProduction && !body.confirmedProduction) {
          sendJson(res, 409, { error: 'production_confirmation_required' });
          return;
        }
      }

      const result = isDeploy ? await deployFiles(body.targetOrg, body.files) : await validateFiles(body.targetOrg, body.files);
      sendJson(res, 200, result);
      return;
    }

    next();
  } catch (e) {
    if (e instanceof BodyTooLargeError) {
      sendJson(res, 413, { error: 'Request body too large.' });
      return;
    }
    sendJson(res, 500, { error: e instanceof Error ? e.message : String(e), kind: 'unexpected' });
  }
}
