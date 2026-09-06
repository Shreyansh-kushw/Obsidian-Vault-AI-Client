import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowUp,
  CheckCircle2,
  Folder,
  FolderOpen,
  FolderPlus,
    Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import { addVault, browseFilesystem, fetchDiscoveredVaults, validateLocalPath } from '../lib/api';
import type { DiscoveredVault, FsBrowseResult } from '../types';

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
  const [discoveredVaults, setDiscoveredVaults] = useState<DiscoveredVault[]>([]);
  const [browseResult, setBrowseResult] = useState<FsBrowseResult | null>(null);
  const [loadingBrowse, setLoadingBrowse] = useState(false);

  const [pathValidation, setPathValidation] = useState<{
    tested: boolean;
    valid: boolean;
    count: number;
    error?: string;
  }>({ tested: false, valid: false, count: 0 });

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      // Load auto-detected Obsidian vaults
      fetchDiscoveredVaults()
        .then((vaults) => {
          setDiscoveredVaults(vaults);
        })
        .catch(() => {});

      // Load initial folder browser at ~/Documents
      handleNavigate('');
    }
  }, [isOpen]);

  const selectVaultPath = async (path: string, suggestedName?: string) => {
    setLocalPath(path);
    setErrorMsg('');
    if (suggestedName) {
      setVaultName(suggestedName);
    } else {
      const parts = path.split(/[\/]/).filter(Boolean);
      if (parts.length) setVaultName(parts[parts.length - 1]);
    }

    try {
      const res = await validateLocalPath(path);
      if (res.exists && res.is_dir) {
        setPathValidation({
          tested: true,
          valid: true,
          count: res.markdown_count,
        });
      } else {
        setPathValidation({
          tested: true,
          valid: false,
          count: 0,
          error: !res.exists ? 'Directory does not exist' : 'Path is not a directory',
        });
      }
    } catch {
      setPathValidation({
        tested: true,
        valid: false,
        count: 0,
        error: 'Cannot access this directory',
      });
    }
  };

  const handleNavigate = async (path: string) => {
    setLoadingBrowse(true);
    try {
      const res = await browseFilesystem(path);
      setBrowseResult(res);
      // If current folder has markdown files, validate it
      if (res.markdown_count > 0 || res.is_vault) {
        selectVaultPath(res.current_path, res.current_path.split(/[\/]/).pop() || '');
      }
    } catch {
    } finally {
      setLoadingBrowse(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaultName.trim() || !localPath.trim()) return;

    if (!pathValidation.valid) {
      setErrorMsg('Please select a valid local directory.');
      return;
    }

    if (pathValidation.count === 0) {
      setErrorMsg('No Markdown (.md) notes found in this folder.');
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl glass-panel rounded-2xl border border-violet-500/30 p-6 shadow-2xl shadow-violet-500/10 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/30">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Select Obsidian Vault Folder</h3>
              <p className="text-xs text-slate-400">Choose a folder on your computer to automatically read its path & notes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Quick Select Detected Obsidian Vaults */}
        {discoveredVaults.length > 0 && (
          <div className="mt-4 p-3 rounded-xl bg-violet-950/30 border border-violet-500/20 space-y-2">
            <div className="text-xs font-semibold text-violet-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              Detected Obsidian Vaults:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {discoveredVaults.map((dv) => {
                const isSelected = localPath === dv.path;
                return (
                  <button
                    key={dv.path}
                    type="button"
                    onClick={() => selectVaultPath(dv.path, dv.name)}
                    className={'flex items-center space-x-2.5 p-2 rounded-lg border text-left transition-all cursor-pointer ' + (
                      isSelected
                        ? 'bg-violet-600/30 border-violet-400 text-white shadow-md'
                        : 'bg-slate-900/60 hover:bg-slate-800/80 border-white/10 text-slate-300'
                    )}
                  >
                    <Folder className={'w-4 h-4 shrink-0 ' + (isSelected ? 'text-violet-300' : 'text-violet-400')} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate">{dv.name}</div>
                      <div className="text-[10px] text-slate-400 truncate font-mono">{dv.path}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. Visual Folder Browser (Browse your computer) */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-violet-400" />
              Choose Folder from Computer:
            </span>
          </div>

          {browseResult && (
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 space-y-2.5">
              {/* Current Path Bar & Up button */}
              <div className="flex items-center gap-1.5 text-xs font-mono bg-slate-950/80 p-2 rounded-lg border border-white/5">
                {browseResult.parent_path && (
                  <button
                    type="button"
                    onClick={() => handleNavigate(browseResult.parent_path!)}
                    className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded transition shrink-0"
                    title="Go up one directory"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                )}
                <span className="text-slate-300 truncate flex-1" title={browseResult.current_path}>
                  {browseResult.current_path}
                </span>
                <button
                  type="button"
                  onClick={() => selectVaultPath(browseResult.current_path, browseResult.current_path.split(/[\/]/).pop() || '')}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded cursor-pointer shrink-0"
                >
                  Select This Folder
                </button>
              </div>

              {/* Subfolders Grid */}
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                {loadingBrowse ? (
                  <div className="py-4 flex justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                  </div>
                ) : browseResult.directories.length === 0 ? (
                  <div className="py-3 text-center text-xs text-slate-500">No subfolders in this directory</div>
                ) : (
                  browseResult.directories.map((dir) => (
                    <div
                      key={dir.path}
                      className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white/5 transition text-xs group"
                    >
                      <button
                        type="button"
                        onClick={() => handleNavigate(dir.path)}
                        className="flex items-center gap-2 text-left flex-1 min-w-0 text-slate-300 hover:text-white cursor-pointer"
                      >
                        <Folder className={'w-3.5 h-3.5 shrink-0 ' + (dir.is_vault ? 'text-violet-400' : 'text-slate-500')} />
                        <span className="truncate font-medium">{dir.name}</span>
                        {dir.markdown_count > 0 && (
                          <span className="text-[10px] text-emerald-400/80 shrink-0">({dir.markdown_count} notes)</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => selectVaultPath(dir.path, dir.name)}
                        className="text-[11px] px-2 py-0.5 rounded bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white transition cursor-pointer"
                      >
                        Select
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* 3. Selected Folder Info & Submit */}
        <form onSubmit={handleSubmit} className="space-y-3.5 pt-3 border-t border-white/10 mt-3">
          {/* Selected Path Preview */}
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Selected Local Path (Automatically Captured)
            </div>
            <div className="text-xs font-mono text-violet-200 bg-slate-950/60 p-2.5 rounded-xl border border-white/10 break-all">
              {localPath || '(Click a folder above to select)'}
            </div>

            {pathValidation.tested && (
              <div
                className={'text-[11px] flex items-center gap-1.5 px-2.5 py-1 rounded-lg mt-1 ' + (
                  pathValidation.valid
                    ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/20'
                    : 'bg-rose-950/40 text-rose-300 border border-rose-500/20'
                )}
              >
                {pathValidation.valid ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>
                      Ready to sync: <strong>{pathValidation.count}</strong> Markdown notes detected
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
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">
              Vault Name
            </label>
            <input
              type="text"
              value={vaultName}
              onChange={(e) => setVaultName(e.target.value)}
              placeholder="Vault Name"
              required
              className="w-full text-xs px-3 py-2 rounded-xl glass-input"
            />
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex justify-end space-x-2 border-t border-white/10">
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
                  <span>Ingesting & Starting Watcher...</span>
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
