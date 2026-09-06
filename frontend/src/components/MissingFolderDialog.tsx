import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Trash2, X, ArrowRight, FolderSearch } from 'lucide-react';
import type { MissingFolderAlert } from '../types';
import { deleteVault, updateVaultPath, validateLocalPath } from '../lib/api';

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
  const [validationResult, setValidationResult] = useState<{
    tested: boolean;
    valid: boolean;
    count: number;
    error?: string;
  }>({ tested: false, valid: false, count: 0 });

  if (!missingFolders.length) return null;

  const current = missingFolders[currentIdx] || missingFolders[0];
  if (!current) return null;

  const handleValidate = async (path: string) => {
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

  const handleDeleteFromDB = async () => {
    setIsDeleting(true);
    try {
      await deleteVault(current.vault_id);
      onResolved(current.vault_id);
    } catch (err: any) {
      alert(`Error removing vault: ${err.message}`);
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
      alert(`Error updating path: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg glass-panel rounded-2xl border border-amber-500/30 p-6 shadow-2xl shadow-amber-500/10">
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
                Vault <span className="font-semibold text-slate-200 font-mono">"{current.vault_name}"</span> was imported earlier but its folder does not exist on this computer.
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
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Registered Path in Database</div>
            <div className="text-xs font-mono text-amber-300/90 break-all bg-amber-950/30 p-2 rounded border border-amber-500/20">
              {current.local_vault_path}
            </div>
          </div>

          {/* Option A: Update Local Path */}
          <div className="space-y-2 p-3.5 rounded-xl bg-slate-900/60 border border-white/5">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <FolderSearch className="w-3.5 h-3.5 text-violet-400" />
              Relocate folder on this machine:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPath}
                onChange={(e) => {
                  setNewPath(e.target.value);
                  handleValidate(e.target.value);
                }}
                placeholder="/home/username/Documents/MyVault"
                className="flex-1 text-xs px-3 py-2 rounded-lg glass-input font-mono"
              />
              <button
                onClick={handleUpdatePath}
                disabled={!validationResult.valid || isUpdating}
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1"
              >
                <span>Save Path</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Validation Feedback */}
            {validationResult.tested && (
              <div className={`text-[11px] flex items-center gap-1.5 mt-1 ${validationResult.valid ? 'text-emerald-400' : 'text-rose-400'}`}>
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
