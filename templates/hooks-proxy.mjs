import { createServer } from 'node:http';

const PORT = process.env.PORT || 18800;
const GATEWAY = process.env.GATEWAY_URL || 'http://127.0.0.1:18789';
const TOKEN = process.env.OPENCLAW_HOOK_TOKEN;

if (!TOKEN) {
  console.error('OPENCLAW_HOOK_TOKEN is required');
  process.exit(1);
}

// Routes are injected during setup
const ROUTES = __ROUTES__;

const server = createServer(async (req, res) => {
  const route = ROUTES.find(r => req.url?.startsWith(r.path));
  if (!route) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();

    // Validate secret if configured
    if (route.secretHeader && req.headers[route.secretHeader.toLowerCase()] !== route.secretValue) {
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    // Forward to gateway with auth token
    const targetUrl = `${GATEWAY}${route.targetPath || req.url}`;
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        ...Object.fromEntries(Object.entries(req.headers).filter(([k]) => k !== 'host')),
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': req.headers['content-type'] || 'application/json',
      },
      body: ['POST', 'PUT', 'PATCH'].includes(req.method || '') ? body : undefined,
    });

    res.writeHead(response.status);
    const responseBody = await response.text();
    res.end(responseBody);
  } catch (error) {
    console.error(`Proxy error for ${req.url}:`, error);
    res.writeHead(502);
    res.end('Bad Gateway');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Hooks proxy listening on 127.0.0.1:${PORT}`);
});
