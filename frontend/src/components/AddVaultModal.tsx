import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Folder, FolderPlus, Loader2, Sparkles, X } from 'lucide-react';
import { addVault, validateLocalPath } from '../lib/api';

interface AddVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVaultAdded: () => void;
}

export const AddVaultModal: React.FC<AddVaultModalProps> = ({ isOpen, onClose, onVaultAdded }) => {
  const [vaultName, setVaultName] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [pathValidation, setPathValidation] = useState<{
    tested: boolean;
    valid: boolean;
    count: number;
    error?: string;
  }>({ tested: false, valid: false, count: 0 });

  if (!isOpen) return null;

  const handlePathChange = async (path: string) => {
    setLocalPath(path);
    setErrorMsg('');
    if (!path.trim()) {
      setPathValidation({ tested: false, valid: false, count: 0 });
      return;
    }

    try {
      const res = await validateLocalPath(path.trim());
      if (res.exists && res.is_dir) {
        setPathValidation({
          tested: true,
          valid: true,
          count: res.markdown_count,
        });
        // Auto suggest vault name if empty
        if (!vaultName) {
          const parts = res.path.split(/[\/\\]/).filter(Boolean);
          if (parts.length) setVaultName(parts[parts.length - 1]);
        }
      } else {
        setPathValidation({
          tested: true,
          valid: false,
          count: 0,
          error: !res.exists ? 'Directory does not exist on disk' : 'Path is a file, not a directory',
        });
      }
    } catch {
      setPathValidation({
        tested: true,
        valid: false,
        count: 0,
        error: 'Cannot access this path',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaultName.trim() || !localPath.trim()) return;

    if (!pathValidation.valid) {
      setErrorMsg('Please specify a valid existing local directory.');
      return;
    }

    if (pathValidation.count === 0) {
      setErrorMsg('No .md (Markdown) files found in this directory.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await addVault(vaultName.trim(), localPath.trim());
      onVaultAdded();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add vault');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg glass-panel rounded-2xl border border-violet-500/30 p-6 shadow-2xl shadow-violet-500/10">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/30">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Add New Obsidian Vault</h3>
              <p className="text-xs text-slate-400">Import local notes & attach live Watchdog</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {/* Local Folder Path */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-violet-400" />
              Local Vault Folder Path <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={localPath}
              onChange={(e) => handlePathChange(e.target.value)}
              placeholder="/home/username/Documents/MyObsidianVault"
              required
              className="w-full text-xs px-3.5 py-2.5 rounded-xl glass-input font-mono"
            />

            {/* Path status feedback */}
            {pathValidation.tested && (
              <div
                className={`text-[11px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
                  pathValidation.valid
                    ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/20'
                    : 'bg-rose-950/40 text-rose-300 border border-rose-500/20'
                }`}
              >
                {pathValidation.valid ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>
                      Found directory with <strong>{pathValidation.count}</strong> Markdown note{pathValidation.count !== 1 ? 's' : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>{pathValidation.error}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Vault Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              Vault Display Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={vaultName}
              onChange={(e) => setVaultName(e.target.value)}
              placeholder="e.g. Work Notes & Projects"
              required
              className="w-full text-xs px-3.5 py-2.5 rounded-xl glass-input"
            />
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-700/60 rounded-xl border border-white/10 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !pathValidation.valid || pathValidation.count === 0}
              className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-violet-600/25 border border-violet-400/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Importing & Indexing...</span>
                </>
              ) : (
                <>
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Import & Start Watching</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
