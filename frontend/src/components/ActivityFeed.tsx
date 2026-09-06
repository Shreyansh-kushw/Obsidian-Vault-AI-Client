import React from 'react';
import { Activity, AlertCircle, CheckCircle2, Clock, Trash2, Zap } from 'lucide-react';
import type { ActivityLog } from '../types';

interface ActivityFeedProps {
  logs: ActivityLog[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ logs }) => {
  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'warning':
        return <Trash2 className="w-3.5 h-3.5 text-amber-400" />;
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return <Zap className="w-3.5 h-3.5 text-violet-400" />;
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5 border border-white/10 flex flex-col h-full max-h-[560px]">
      <div className="flex items-center justify-between pb-3.5 border-b border-white/10 mb-3">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-bold text-white">Live Watcher Stream</h3>
        </div>
        <span className="text-[11px] font-mono text-slate-500">
          {logs.length} event{logs.length !== 1 ? 's' : ''}
        </span>
      </div>

      {logs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
          <Clock className="w-8 h-8 text-slate-600 mb-2" />
          <p className="text-xs text-slate-400">Waiting for file system changes...</p>
          <p className="text-[11px] text-slate-600 mt-1">Edits in Obsidian will appear here instantly</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {logs.map((log) => (
            <div
              key={log.id}
              className="p-2.5 rounded-xl bg-slate-950/40 border border-white/5 hover:border-white/10 transition-colors text-xs flex items-start space-x-2.5"
            >
              <div className="mt-0.5 shrink-0">{getLogIcon(log.level)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-200 text-[12px] leading-snug break-words font-sans">
                  {log.message}
                </p>
                <span className="text-[10px] font-mono text-slate-500 mt-0.5 block">
                  {formatTime(log.timestamp)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
