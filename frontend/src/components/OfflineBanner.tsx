import React from 'react';
import { Clock, RefreshCw, WifiOff } from 'lucide-react';

interface OfflineBannerProps {
  isOnline: boolean;
  connectionMessage: string;
  pendingQueueCount: number;
  onRetry: () => void;
  isRetrying: boolean;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  isOnline,
  connectionMessage,
  pendingQueueCount,
  onRetry,
  isRetrying,
}) => {
  if (isOnline) return null;

  return (
    <div className="w-full bg-gradient-to-r from-rose-950/80 via-amber-950/60 to-rose-950/80 border-b border-rose-500/30 px-4 py-2.5 text-xs text-rose-200">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center space-x-2.5">
          <div className="p-1 rounded-full bg-rose-500/20 text-rose-400">
            <WifiOff className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-rose-100">Server Connection Unavailable:</span>{' '}
            <span className="text-rose-200/80">{connectionMessage}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {pendingQueueCount > 0 && (
            <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-medium">
              <Clock className="w-3 h-3 animate-pulse" />
              <span>{pendingQueueCount} pending change{pendingQueueCount > 1 ? 's' : ''} queued</span>
            </div>
          )}

          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="flex items-center space-x-1 px-3 py-1 rounded bg-rose-600/80 hover:bg-rose-500 text-white font-medium border border-rose-400/40 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>Retry Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};
