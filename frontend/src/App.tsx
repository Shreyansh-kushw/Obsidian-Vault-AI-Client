import { useEffect, useState } from 'react';
import {
  Clock,
  Eye,
  FileText,
  FolderPlus,
  Layers,
  Plus,
  Search,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useClientWebSocket } from './lib/useClientWebSocket';
import { fetchConfig, fetchVaults, triggerSyncAll } from './lib/api';
import { Navbar } from './components/Navbar';
import { OfflineBanner } from './components/OfflineBanner';
import { MissingFolderDialog } from './components/MissingFolderDialog';
import { TokenModal } from './components/TokenModal';
import { AddVaultModal } from './components/AddVaultModal';
import { VaultCard } from './components/VaultCard';
import { ActivityFeed } from './components/ActivityFeed';

export function App() {
  const {
    isWsConnected,
    isOnline,
    connectionMessage,
    latencyMs,
    vaults,
    missingFolders,
    pendingQueueCount,
    activityLogs,
    setVaults,
    setMissingFolders,
  } = useClientWebSocket();

  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [isAddVaultModalOpen, setIsAddVaultModalOpen] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [ignoredMissingVaults, setIgnoredMissingVaults] = useState<Set<string>>(new Set());

  // Check on mount if token is configured
  useEffect(() => {
    fetchConfig()
      .then((cfg) => {
        if (!cfg.is_configured || !cfg.owner_token) {
          setIsTokenModalOpen(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    try {
      await triggerSyncAll();
      const updated = await fetchVaults();
      setVaults(updated);
    } catch (err: any) {
      alert(`Sync error: ${err.message}`);
    } finally {
      setTimeout(() => setIsSyncingAll(false), 800);
    }
  };

  const handleVaultDeleted = (deletedId: string) => {
    setVaults((prev) => prev.filter((v) => v.vault_id !== deletedId));
    setMissingFolders((prev) => prev.filter((m) => m.vault_id !== deletedId));
  };

  const handleVaultsUpdated = async () => {
    try {
      const updated = await fetchVaults();
      setVaults(updated);
    } catch {}
  };

  const activeMissingAlerts = missingFolders.filter(
    (m) => !ignoredMissingVaults.has(m.vault_id)
  );

  const filteredVaults = vaults.filter(
    (v) =>
      v.vault_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.local_vault_path && v.local_vault_path.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalNotesCount = vaults.reduce((acc, v) => acc + (v.totalFiles || 0), 0);
  const activeWatchersCount = vaults.filter((v) => v.watcher_status === 'Watching').length;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top Navigation */}
      <Navbar
        isOnline={isOnline}
        isWsConnected={isWsConnected}
        latencyMs={latencyMs}
        connectionMessage={connectionMessage}
        onOpenSettings={() => setIsTokenModalOpen(true)}
        onOpenAddVault={() => setIsAddVaultModalOpen(true)}
        onSyncAll={handleSyncAll}
        isSyncing={isSyncingAll}
      />

      {/* Offline Status Warning Banner */}
      <OfflineBanner
        isOnline={isOnline}
        connectionMessage={connectionMessage}
        pendingQueueCount={pendingQueueCount}
        onRetry={handleSyncAll}
        isRetrying={isSyncingAll}
      />

      {/* Missing Local Folder Alert Dialog Modal */}
      {activeMissingAlerts.length > 0 && (
        <MissingFolderDialog
          missingFolders={activeMissingAlerts}
          onResolved={(vaultId) => {
            setMissingFolders((prev) => prev.filter((m) => m.vault_id !== vaultId));
            handleVaultsUpdated();
          }}
          onIgnored={(vaultId) => {
            setIgnoredMissingVaults((prev) => new Set(prev).add(vaultId));
          }}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Overview Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Stat 1: Active Watchers */}
          <div className="glass-card rounded-2xl p-4 flex items-center space-x-3.5">
            <div className="p-3 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Active Watchers</p>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-xl font-bold text-white">{activeWatchersCount}</span>
                <span className="text-xs text-slate-500">of {vaults.length} vaults</span>
              </div>
            </div>
          </div>

          {/* Stat 2: Total Indexed Notes */}
          <div className="glass-card rounded-2xl p-4 flex items-center space-x-3.5">
            <div className="p-3 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Notes</p>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-xl font-bold text-white">{totalNotesCount}</span>
                <span className="text-xs text-slate-500">embedded</span>
              </div>
            </div>
          </div>

          {/* Stat 3: Auto-Sync Engine */}
          <div className="glass-card rounded-2xl p-4 flex items-center space-x-3.5">
            <div className="p-3 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Sync Mode</p>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-sm font-bold text-emerald-300">Live Auto-Sync</span>
                <span className="text-[10px] text-slate-500">1.0s debounced</span>
              </div>
            </div>
          </div>

          {/* Stat 4: Pending Offline Queue */}
          <div className="glass-card rounded-2xl p-4 flex items-center space-x-3.5">
            <div className={`p-3 rounded-xl ${pendingQueueCount > 0 ? 'bg-amber-600/20 text-amber-400 border-amber-500/30' : 'bg-slate-800/40 text-slate-400 border-white/5'}`}>
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Offline Queue</p>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-xl font-bold text-white">{pendingQueueCount}</span>
                <span className="text-xs text-slate-500">pending</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Vaults List */}
          <div className="lg:col-span-2 space-y-4">
            {/* Header & Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-violet-400" />
                  <span>Obsidian Vaults</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-normal">
                    {filteredVaults.length}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Monitored local folders automatically synced with server
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter vaults or paths..."
                  className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl glass-input"
                />
              </div>
            </div>

            {/* Vault Cards Grid */}
            {filteredVaults.length === 0 ? (
              <div className="glass-card rounded-2xl p-10 flex flex-col items-center justify-center text-center border-dashed border-white/10">
                <div className="p-4 rounded-2xl bg-violet-600/10 text-violet-400 border border-violet-500/20 mb-3">
                  <FolderPlus className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-white">No Vaults Found</h3>
                <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
                  {vaults.length === 0
                    ? 'You have not added any Obsidian vaults yet. Click below to import and watch a local vault folder.'
                    : 'No vaults match your current search filter.'}
                </p>
                {vaults.length === 0 && (
                  <button
                    onClick={() => setIsAddVaultModalOpen(true)}
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/25 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Your First Vault</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredVaults.map((vault) => (
                  <VaultCard
                    key={vault.vault_id}
                    vault={vault}
                    onDeleted={handleVaultDeleted}
                    onUpdated={handleVaultsUpdated}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right Col: Live Activity Stream & Tips */}
          <div className="space-y-4">
            <ActivityFeed logs={activityLogs} />

            {/* Info Helper Box */}
            <div className="glass-card rounded-2xl p-4.5 border border-white/10 space-y-2 text-xs">
              <div className="flex items-center space-x-2 text-violet-300 font-semibold">
                <ShieldCheck className="w-4 h-4 text-violet-400" />
                <span>How Watcher Sync Works</span>
              </div>
              <ul className="text-slate-400 space-y-1.5 text-[11px] leading-relaxed list-disc list-inside">
                <li>Edits to <code className="text-slate-300">.md</code> notes in Obsidian trigger instant debounced re-indexing.</li>
                <li>Deleted markdown notes automatically purge their chunks and embeddings from the vector database.</li>
                <li>If the network drops, file changes are queued safely and auto-flushed when connection returns.</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <TokenModal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
        onSaved={handleVaultsUpdated}
      />

      <AddVaultModal
        isOpen={isAddVaultModalOpen}
        onClose={() => setIsAddVaultModalOpen(false)}
        onVaultAdded={handleVaultsUpdated}
      />
    </div>
  );
}

export default App;
