import type { ClientConfig, ClientDaemonStatus, Vault, ActivityLog, DiscoveredVault, FsBrowseResult } from '../types';

const CLIENT_API_BASE = import.meta.env.VITE_CLIENT_API_URL || 'http://localhost:5050';

export async function fetchStatus(): Promise<ClientDaemonStatus> {
  const res = await fetch(`${CLIENT_API_BASE}/api/status`);
  if (!res.ok) throw new Error('Failed to reach client daemon');
  return res.json();
}

export async function fetchConfig(): Promise<ClientConfig> {
  const res = await fetch(`${CLIENT_API_BASE}/api/config`);
  if (!res.ok) throw new Error('Failed to fetch config');
  return res.json();
}

export async function updateConfig(payload: {
  server_url: string;
  api_key?: string;
  owner_token: string;
}): Promise<any> {
  const res = await fetch(`${CLIENT_API_BASE}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to update config');
  }
  return res.json();
}

export async function fetchVaults(): Promise<Vault[]> {
  const res = await fetch(`${CLIENT_API_BASE}/api/vaults`);
  if (!res.ok) throw new Error('Failed to fetch vaults');
  return res.json();
}

export async function fetchDiscoveredVaults(): Promise<DiscoveredVault[]> {
  const res = await fetch(`${CLIENT_API_BASE}/api/discovered-vaults`);
  if (!res.ok) throw new Error('Failed to fetch discovered vaults');
  return res.json();
}

export async function browseFilesystem(path?: string): Promise<FsBrowseResult> {
  const url = path ? `${CLIENT_API_BASE}/api/fs/browse?path=${encodeURIComponent(path)}` : `${CLIENT_API_BASE}/api/fs/browse`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to browse directory');
  return res.json();
}

export async function triggerSyncAll(): Promise<void> {
  const res = await fetch(`${CLIENT_API_BASE}/api/vaults/sync-all`, { method: 'POST' });
  if (!res.ok) throw new Error('Sync failed');
}

export async function reconcileVault(vaultId: string): Promise<void> {
  const res = await fetch(`${CLIENT_API_BASE}/api/vaults/${vaultId}/reconcile`, { method: 'POST' });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Reconciliation failed');
  }
}

export async function validateLocalPath(path: string): Promise<{
  exists: boolean;
  is_dir: boolean;
  markdown_count: number;
  path: string;
}> {
  const res = await fetch(`${CLIENT_API_BASE}/api/validate-path`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error('Failed to validate directory');
  return res.json();
}

export async function addVault(vaultName: string, localVaultPath: string): Promise<Vault> {
  const res = await fetch(`${CLIENT_API_BASE}/api/vaults/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vault_name: vaultName,
      local_vault_path: localVaultPath,
    }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to add vault');
  }
  return res.json();
}

export async function deleteVault(vaultId: string): Promise<void> {
  const res = await fetch(`${CLIENT_API_BASE}/api/vaults/${vaultId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to delete vault');
  }
}

export async function updateVaultPath(vaultId: string, newPath: string): Promise<void> {
  const res = await fetch(`${CLIENT_API_BASE}/api/vaults/${vaultId}/path`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ local_vault_path: newPath }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to update vault path');
  }
}

export async function fetchLogs(): Promise<ActivityLog[]> {
  const res = await fetch(`${CLIENT_API_BASE}/api/logs`);
  if (!res.ok) throw new Error('Failed to fetch logs');
  return res.json();
}
