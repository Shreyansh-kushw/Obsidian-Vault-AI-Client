import React, { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Edit2,
  FileText,
  Folder,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { Vault } from '../types';
import { deleteVault, reconcileVault, updateVaultPath, validateLocalPath } from '../lib/api';

interface VaultCardProps {
  vault: Vault;
  onDeleted: (vaultId: string) => void;
  onUpdated: () => void;
}

export const VaultCard: React.FC<VaultCardProps> = ({ vault, onDeleted, onUpdated }) => {
  const [isReconciling, setIsReconciling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [newPath, setNewPath] = useState(vault.local_vault_path || '');
  const [pathValid, setPathValid] = useState<boolean | null>(null);

  const isWatching = vault.watcher_status === 'Watching';
  const isMissing = vault.folder_missing || vault.watcher_status === 'Folder Missing';

  const handleReconcile = async () => {
    setIsReconciling(true);
    try {
      await reconcileVault(vault.vault_id);
    } catch (err: any) {
      alert(`Reconciliation error: ${err.message}`);
    } finally {
      setTimeout(() => setIsReconciling(false), 1200);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to remove "${vault.vault_name}" and its chunks from the database?`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteVault(vault.vault_id);
      onDeleted(vault.vault_id);
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
      setIsDeleting(false);
    }
  };

  const handleSavePath = async () => {
    if (!newPath.trim()) return;
    try {
      await updateVaultPath(vault.vault_id, newPath.trim());
      setIsEditingPath(false);
      onUpdated();
    } catch (err: any) {
      alert(`Failed to update path: ${err.message}`);
    }
  };

  const handleValidateNewPath = async (val: string) => {
    setNewPath(val);
    if (!val.trim()) {
      setPathValid(null);
      return;
    }
    try {
      const res = await validateLocalPath(val);
      setPathValid(res.exists && res.is_dir);
    } catch {
      setPathValid(false);
    }
  };

  const progressPercent = vault.totalFiles > 0 
    ? Math.min(100, Math.round(((vault.succeeded || vault.totalFiles) / vault.totalFiles) * 100))
    : 100;

  return (
    <div className={`glass-card rounded-2xl p-5 relative overflow-hidden transition-all duration-300 ${
      isMissing ? 'border-amber-500/40 bg-amber-950/10' : ''
    }`}>
      {/* Top Bar: Vault Name & Watchdog Badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center space-x-3">
          <div className={`p-2.5 rounded-xl ${
            isMissing
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-violet-600/20 text-violet-400 border border-violet-500/30'
          }`}>
            <Folder className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>{vault.vault_name || vault.name}</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-500">ID: {vault.vault_id.slice(0, 12)}...</span>
          </div>
        </div>

        {/* Watchdog Status Badge */}
        <div>
          {isMissing ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              Folder Missing
            </span>
          ) : isWatching ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Watchdog Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-white/10">
              <Clock className="w-3 h-3" />
              Stopped
            </span>
          )}
        </div>
      </div>

      {/* Local Path Section */}
      <div className="my-3">
        {isEditingPath ? (
          <div className="space-y-1.5 p-2 rounded-xl bg-slate-900/80 border border-white/10">
            <div className="flex gap-2">
              <input
                type="text"
                value={newPath}
                onChange={(e) => handleValidateNewPath(e.target.value)}
                placeholder="/path/to/vault"
                className="flex-1 text-xs px-2.5 py-1.5 rounded-lg glass-input font-mono"
              />
              <button
                onClick={handleSavePath}
                disabled={pathValid === false}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 cursor-pointer"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditingPath(false)}
                className="px-2 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            </div>
            {pathValid !== null && (
              <p className={`text-[10px] ${pathValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                {pathValid ? '✓ Valid folder' : '✗ Folder does not exist'}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/40 border border-white/5 text-xs font-mono text-slate-400">
            <span className="truncate max-w-[80%]" title={vault.local_vault_path || ''}>
              {vault.local_vault_path || '(No local path)'}
            </span>
            <button
              onClick={() => {
                setNewPath(vault.local_vault_path || '');
                setIsEditingPath(true);
              }}
              className="p-1 text-slate-500 hover:text-violet-400 transition-colors cursor-pointer"
              title="Change local directory path"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Stats & Progress Bar */}
      <div className="space-y-2 pt-1 pb-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Indexed Notes:</span>
            <strong className="text-slate-200 font-semibold">{vault.totalFiles || 0}</strong>
          </span>
          <span className="text-[11px] text-slate-500 font-medium">
            {vault.status === 'Processing' ? 'Syncing...' : '100% Synced'}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-violet-500 to-indigo-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <button
          onClick={handleReconcile}
          disabled={isReconciling || isMissing}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-700/60 border border-white/10 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="Scan folder & synchronize differences with server"
        >
          <RefreshCw className={`w-3 h-3 ${isReconciling ? 'animate-spin text-violet-400' : ''}`} />
          <span>{isReconciling ? 'Reconciling...' : 'Re-scan & Sync'}</span>
        </button>

        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
          title="Remove vault and chunks from database"
        >
          {isDeleting ? <Loader2 className="w-4 h-4 animate-spin text-rose-400" /> : <Trash2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
