import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Folder,
    FolderSearch,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { DiscoveredVault, MissingFolderAlert } from '../types';
import { deleteVault, fetchDiscoveredVaults, updateVaultPath, validateLocalPath } from '../lib/api';

interface MissingFolderDialogProps {
  missingFolders: MissingFolderAlert[];
  onResolved: (vaultId: string) => void;
  onIgnored: (vaultId: string) => void;
}

export const MissingFolderDialog: React.FC<MissingFolderDialogProps> = ({
  missingFolders,
  onResolved,
  onIgnored,
}) => {
  const [currentIdx] = useState(0);
  const [newPath, setNewPath] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [discoveredVaults, setDiscoveredVaults] = useState<DiscoveredVault[]>([]);
  const [validationResult, setValidationResult] = useState<{
    tested: boolean;
    valid: boolean;
    count: number;
    error?: string;
  }>({ tested: false, valid: false, count: 0 });

  useEffect(() => {
    fetchDiscoveredVaults()
      .then((vaults) => setDiscoveredVaults(vaults))
      .catch(() => {});
  }, []);

  if (!missingFolders.length) return null;

  const current = missingFolders[currentIdx] || missingFolders[0];
  if (!current) return null;

  const handleValidate = async (path: string) => {
    setNewPath(path);
    if (!path.trim()) {
      setValidationResult({ tested: false, valid: false, count: 0 });
      return;
    }
    try {
      const res = await validateLocalPath(path);
      if (res.exists && res.is_dir) {
        setValidationResult({
          tested: true,
          valid: true,
          count: res.markdown_count,
        });
      } else {
        setValidationResult({
          tested: true,
          valid: false,
          count: 0,
          error: !res.exists ? 'Directory does not exist' : 'Path is not a folder',
        });
      }
    } catch {
      setValidationResult({
        tested: true,
        valid: false,
        count: 0,
        error: 'Failed to access path',
      });
    }
  };

  const handleSelectDiscovered = (path: string) => {
    handleValidate(path);
  };

  const handleDeleteFromDB = async () => {
    setIsDeleting(true);
    try {
      await deleteVault(current.vault_id);
      onResolved(current.vault_id);
    } catch (err: any) {
      alert('Error removing vault: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdatePath = async () => {
    if (!newPath.trim()) return;
    setIsUpdating(true);
    try {
      await updateVaultPath(current.vault_id, newPath.trim());
      onResolved(current.vault_id);
      setNewPath('');
      setValidationResult({ tested: false, valid: false, count: 0 });
    } catch (err: any) {
      alert('Error updating path: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg glass-panel rounded-2xl border border-amber-500/30 p-6 shadow-2xl shadow-amber-500/10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Local Vault Folder Missing
                {missingFolders.length > 1 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-normal">
                    {currentIdx + 1} of {missingFolders.length}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Vault <span className="font-semibold text-slate-200 font-mono">"{current.vault_name}"</span> was imported on the server but its local path is not linked on this computer.
              </p>
            </div>
          </div>
          <button
            onClick={() => onIgnored(current.vault_id)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Ignore for now"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Details */}
        <div className="py-4 space-y-4">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 space-y-1.5">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Current Server Path Entry</div>
            <div className="text-xs font-mono text-amber-300/90 break-all bg-amber-950/30 p-2 rounded border border-amber-500/20">
              {current.local_vault_path || '(No path set / NULL in DB)'}
            </div>
          </div>

          {/* Quick 1-Click Discovered Vaults */}
          {discoveredVaults.length > 0 && (
            <div className="p-3 rounded-xl bg-violet-950/30 border border-violet-500/20 space-y-2">
              <div className="text-xs font-semibold text-violet-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                1-Click Select Detected Vault on this Computer:
              </div>
              <div className="space-y-1.5">
                {discoveredVaults.map((dv) => (
                  <button
                    key={dv.path}
                    type="button"
                    onClick={() => handleSelectDiscovered(dv.path)}
                    className={'w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition border cursor-pointer ' + (
                      newPath === dv.path
                        ? 'bg-violet-600/30 border-violet-400 text-white'
                        : 'bg-slate-900/60 hover:bg-slate-800/80 border-white/5 text-slate-300'
                    )}
                  >
                    <div className="flex items-center space-x-2 truncate flex-1">
                      <Folder className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                      <span className="font-medium truncate">{dv.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono truncate">({dv.path})</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 shrink-0 ml-2 font-medium">{dv.markdown_count} notes</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Path Input Box */}
          <div className="space-y-2 p-3.5 rounded-xl bg-slate-900/60 border border-white/5">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <FolderSearch className="w-3.5 h-3.5 text-violet-400" />
              Selected Local Directory Path:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPath}
                onChange={(e) => handleValidate(e.target.value)}
                placeholder="/home/username/Documents/MyVault"
                className="flex-1 text-xs px-3 py-2 rounded-lg glass-input font-mono"
              />
              <button
                onClick={handleUpdatePath}
                disabled={!validationResult.valid || isUpdating}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1"
              >
                <span>Save Path</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Validation Feedback */}
            {validationResult.tested && (
              <div className={'text-[11px] flex items-center gap-1.5 mt-1 ' + (validationResult.valid ? 'text-emerald-400' : 'text-rose-400')}>
                {validationResult.valid ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Valid folder found ({validationResult.count} Markdown notes detected)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{validationResult.error}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/10">
          <button
            onClick={handleDeleteFromDB}
            disabled={isDeleting}
            className="w-full sm:w-auto flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>{isDeleting ? 'Deleting...' : 'Remove Vault from Database'}</span>
          </button>

          <button
            onClick={() => onIgnored(current.vault_id)}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-700/60 border border-white/10 transition-all cursor-pointer"
          >
            Skip / Ignore for now
          </button>
        </div>
      </div>
    </div>
  );
};
