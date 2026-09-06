import React, { useEffect, useState } from 'react';
import { Check, Key, Loader2, Lock, Server, ShieldCheck, X } from 'lucide-react';
import { fetchConfig, updateConfig } from '../lib/api';

interface TokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const TokenModal: React.FC<TokenModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [serverUrl, setServerUrl] = useState('http://localhost:8000');
  const [apiKey, setApiKey] = useState('');
  const [ownerToken, setOwnerToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setErrorMsg('');
      setSuccessMsg('');
      fetchConfig()
        .then((cfg) => {
          if (cfg.server_url) setServerUrl(cfg.server_url);
          if (cfg.api_key) setApiKey(cfg.api_key);
          if (cfg.owner_token) setOwnerToken(cfg.owner_token);
        })
        .catch(() => {})
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerToken.trim()) {
      setErrorMsg('Owner Token is required to identify your vaults.');
      return;
    }
    if (!serverUrl.trim()) {
      setErrorMsg('Server URL is required.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await updateConfig({
        server_url: serverUrl.trim(),
        api_key: apiKey.trim(),
        owner_token: ownerToken.trim(),
      });
      setSuccessMsg('Credentials saved & verified with server!');
      setTimeout(() => {
        onSaved();
        onClose();
      }, 800);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg glass-panel rounded-2xl border border-violet-500/30 p-6 shadow-2xl shadow-violet-500/10">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Client Authentication & Settings</h3>
              <p className="text-xs text-slate-400">Connect this watcher daemon to your backend server</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tip Box */}
        <div className="my-4 p-3 rounded-xl bg-violet-950/40 border border-violet-500/20 text-xs text-violet-200 space-y-1">
          <div className="font-semibold text-violet-300 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-violet-400" />
            Where to find your Owner Token?
          </div>
          <p className="text-[11px] text-violet-200/80 leading-relaxed">
            Open the <strong className="text-white">Obsidian-Vault-AI-Server Frontend</strong> in your browser (default <code className="text-violet-300 bg-violet-900/40 px-1 py-0.5 rounded">http://localhost:3000</code>), click the <strong className="text-white">Settings</strong> icon in the header, and copy your <strong className="text-white">Owner Token</strong>.
          </p>
        </div>

        {isLoading ? (
          <div className="py-8 flex justify-center items-center">
            <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {/* Owner Token */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-violet-400" />
                Owner Token <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={ownerToken}
                onChange={(e) => setOwnerToken(e.target.value)}
                placeholder="e.g. usr_tok_9a8b7c6d..."
                required
                className="w-full text-xs px-3.5 py-2.5 rounded-xl glass-input font-mono"
              />
              <p className="text-[10px] text-slate-400">Unique user key used to isolate and sync your vaults.</p>
            </div>

            {/* Server URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-violet-400" />
                Backend Server URL <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://localhost:8000"
                required
                className="w-full text-xs px-3.5 py-2.5 rounded-xl glass-input font-mono"
              />
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-slate-400" />
                Server API Key (X-API-KEY)
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Optional API key configured in server .env"
                className="w-full text-xs px-3.5 py-2.5 rounded-xl glass-input font-mono"
              />
            </div>

            {/* Status Feedback */}
            {errorMsg && (
              <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-2.5 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" />
                {successMsg}
              </div>
            )}

            {/* Submit */}
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
                disabled={isSaving}
                className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-violet-600/25 border border-violet-400/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save & Connect</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
