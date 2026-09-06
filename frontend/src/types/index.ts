export type WatcherStatus = 'Watching' | 'Syncing' | 'Folder Missing' | 'Stopped' | 'Error';

export interface Vault {
  id: string;
  vault_id: string;
  name: string;
  vault_name: string;
  local_vault_path?: string | null;
  totalFiles: number;
  succeeded: number;
  status: 'Processing' | 'Success' | 'Failed';
  watcher_status?: WatcherStatus;
  folder_missing?: boolean;
  last_synced?: number;
}

export interface MissingFolderAlert {
  vault_id: string;
  vault_name: string;
  local_vault_path: string;
  detected_at: number;
}

export interface ActivityLog {
  id: string;
  timestamp: number;
  level: 'info' | 'success' | 'warning' | 'error' | 'sync';
  message: string;
  vault_id?: string | null;
  details?: Record<string, any>;
}

export interface ClientConfig {
  server_url: string;
  api_key: string;
  owner_token: string;
  is_configured: boolean;
}

export interface ClientDaemonStatus {
  is_online: boolean;
  connection_message: string;
  server_latency_ms: number;
  is_configured: boolean;
  server_url: string;
  pending_queue_count: number;
  vaults_count: number;
  missing_folders_count: number;
  active_watchers_count: number;
}
