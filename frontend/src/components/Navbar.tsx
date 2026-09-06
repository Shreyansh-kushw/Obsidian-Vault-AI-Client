import React from 'react';
import { Eye, Key, Plus, RefreshCw, Wifi, WifiOff } from 'lucide-react';

interface NavbarProps {
  isOnline: boolean;
  isWsConnected: boolean;
  latencyMs: number;
  connectionMessage: string;
  onOpenSettings: () => void;
  onOpenAddVault: () => void;
  onSyncAll: () => void;
  isSyncing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  isOnline,
  isWsConnected,
  latencyMs,
  connectionMessage,
  onOpenSettings,
  onOpenAddVault,
  onSyncAll,
  isSyncing,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full glass-panel border-b border-white/10 px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand / Title */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-purple-500 shadow-lg shadow-violet-500/25">
            <Eye className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            </span>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
                Obsidian Vault AI
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/30">
                Watcher Client
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Auto-syncs local notes & vectors with AI Context Engine
            </p>
          </div>
        </div>

        {/* Actions & Connection Badge */}
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          {/* Real-time Status Badge */}
          <div
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isOnline
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-950/40 text-rose-300 border-rose-500/30'
            }`}
            title={connectionMessage}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden md:inline">Server Connected</span>
                <span className="text-[11px] opacity-75">({latencyMs}ms)</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                <span>{isWsConnected ? 'Server Offline' : 'Daemon Offline'}</span>
              </>
            )}
          </div>

          {/* Sync All Button */}
          <button
            onClick={onSyncAll}
            disabled={isSyncing || !isOnline}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-white/10 hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            title="Force refresh & sync all vaults"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-violet-400' : ''}`} />
            <span className="hidden sm:inline">Sync All</span>
          </button>

          {/* Add Vault Button */}
          <button
            onClick={onOpenAddVault}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-violet-600/25 border border-violet-400/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Vault</span>
          </button>

          {/* Settings / Owner Token */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700/80 border border-white/10 transition-all cursor-pointer"
            title="Owner Token & Connection Settings"
          >
            <Key className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
