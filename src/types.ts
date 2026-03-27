export interface OpenClawConfig {
  $schema?: string;
  gateway?: {
    port?: number;
    auth?: {
      token?: string;
    };
    bind?: string;
  };
  agents?: {
    defaults?: {
      workspace?: string;
      heartbeat?: {
        model?: string;
      };
      sandbox?: boolean;
      memory?: {
        search?: boolean;
      };
    };
  };
  hooks?: Record<string, HookMapping>;
  channels?: Record<string, ChannelConfig>;
}

export interface ChannelConfig {
  enabled?: boolean;
  token?: string;
  groupPolicy?: 'allowlist' | 'open';
  guilds?: Record<string, unknown>;
  dm?: {
    enabled?: boolean;
    policy?: 'allowlist' | 'open';
    allowFrom?: string[];
  };
}

export interface HookMapping {
  type: string;
  channel: string;
  path?: string;
  secret?: string;
}

export interface CLIConfig {
  hooksDomain?: string;
  gogKeyringPassword?: string;
  cloudflare?: {
    apiToken?: string;
    accountId?: string;
    tunnelId?: string;
  };
  proxyRoutes?: ProxyRoute[];
}

export interface ProxyRoute {
  name: string;
  path: string;
  target: string;
  secretHeader?: string;
  secretField?: string;
}

export interface AuditCheck {
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  message: string;
  fix?: string;
}

export interface BackupInfo {
  filename: string;
  date: Date;
  size: number;
  encrypted: boolean;
}

export interface SetupState {
  currentStep: number;
  completedSteps: string[];
  startedAt: string;
  options: SetupOptions;
}

export interface SetupOptions {
  tailscale: boolean;
  caddy: boolean;
  egress: boolean;
  noInteractive: boolean;
  domain?: string;
}
