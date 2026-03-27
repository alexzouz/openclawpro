import { readCLIConfig } from './config.js';
import type { CLIConfig } from '../types.js';

interface CfApiResponse<T = unknown> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: T;
}

interface CfZone {
  id: string;
  name: string;
  status: string;
}

interface CfTunnelConfig {
  config: {
    ingress: CfIngressRule[];
  };
}

interface CfIngressRule {
  hostname?: string;
  service: string;
  path?: string;
  originRequest?: Record<string, unknown>;
}

export async function cfFetch<T = unknown>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    apiToken: string;
  }
): Promise<CfApiResponse<T>> {
  const { method = 'GET', body, apiToken } = options;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  };

  const fetchOptions: RequestInit = { method, headers };
  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, fetchOptions);
  const data = (await response.json()) as CfApiResponse<T>;

  if (!data.success) {
    const messages = data.errors.map((e) => e.message).join(', ');
    throw new Error(`Cloudflare API error: ${messages}`);
  }

  return data;
}

export async function listZones(apiToken: string): Promise<CfZone[]> {
  const resp = await cfFetch<CfZone[]>('/zones?per_page=50&status=active', {
    apiToken,
  });
  return resp.result;
}

export async function getTunnelConfig(
  accountId: string,
  tunnelId: string,
  apiToken: string
): Promise<CfTunnelConfig> {
  const resp = await cfFetch<CfTunnelConfig>(
    `/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
    { apiToken }
  );
  return resp.result;
}

export async function updateTunnelIngress(
  accountId: string,
  tunnelId: string,
  ingress: CfIngressRule[],
  apiToken: string
): Promise<void> {
  await cfFetch(
    `/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
    {
      method: 'PUT',
      body: { config: { ingress } },
      apiToken,
    }
  );
}

export async function addTunnelHostname(
  accountId: string,
  tunnelId: string,
  hostname: string,
  service: string,
  apiToken: string
): Promise<void> {
  const config = await getTunnelConfig(accountId, tunnelId, apiToken);
  const existingIngress = config.config.ingress;

  // Remove the catch-all rule, add new hostname, then re-add catch-all
  const catchAll = existingIngress.find((r) => !r.hostname);
  const routes = existingIngress.filter((r) => r.hostname);

  // Check if hostname already exists
  const existing = routes.find((r) => r.hostname === hostname);
  if (existing) {
    // Update existing route
    const updatedRoutes = routes.map((r) =>
      r.hostname === hostname ? { ...r, service } : r
    );
    const newIngress = [...updatedRoutes, catchAll || { service: 'http_status:404' }];
    await updateTunnelIngress(accountId, tunnelId, newIngress, apiToken);
  } else {
    // Add new route
    const newIngress = [
      ...routes,
      { hostname, service },
      catchAll || { service: 'http_status:404' },
    ];
    await updateTunnelIngress(accountId, tunnelId, newIngress, apiToken);
  }
}

export async function createDnsCname(
  zoneId: string,
  name: string,
  tunnelId: string,
  apiToken: string
): Promise<void> {
  const target = `${tunnelId}.cfargotunnel.com`;

  // Check if record exists
  const existing = await cfFetch<Array<{ id: string }>>(
    `/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(name)}`,
    { apiToken }
  );

  if (existing.result.length > 0) {
    // Update existing record
    const recordId = existing.result[0].id;
    await cfFetch(`/zones/${zoneId}/dns_records/${recordId}`, {
      method: 'PUT',
      body: { type: 'CNAME', name, content: target, proxied: true },
      apiToken,
    });
  } else {
    // Create new record
    await cfFetch(`/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: { type: 'CNAME', name, content: target, proxied: true },
      apiToken,
    });
  }
}

export function detectHooksDomain(): string | null {
  const config = readCLIConfig();
  return config.hooksDomain || null;
}
