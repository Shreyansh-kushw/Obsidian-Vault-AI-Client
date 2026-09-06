import { useEffect, useRef, useState } from 'react';
import type { ActivityLog, MissingFolderAlert, Vault } from '../types';

const WS_URL = import.meta.env.VITE_CLIENT_WS_URL || 'ws://localhost:5050/ws';

export interface UseClientWebSocketReturn {
  isWsConnected: boolean;
  isOnline: boolean;
  connectionMessage: string;
  latencyMs: number;
  vaults: Vault[];
  missingFolders: MissingFolderAlert[];
  pendingQueueCount: number;
  activityLogs: ActivityLog[];
  setVaults: React.Dispatch<React.SetStateAction<Vault[]>>;
  setMissingFolders: React.Dispatch<React.SetStateAction<MissingFolderAlert[]>>;
}

export function useClientWebSocket(): UseClientWebSocketReturn {
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState('Connecting to client daemon...');
  const [latencyMs, setLatencyMs] = useState(0);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [missingFolders, setMissingFolders] = useState<MissingFolderAlert[]>([]);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let unmounted = false;

    function connect() {
      if (unmounted) return;

      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (unmounted) return;
          setIsWsConnected(true);
        };

        ws.onmessage = (event) => {
          if (unmounted) return;
          try {
            const msg = JSON.parse(event.data);

            switch (msg.type) {
              case 'initial_state':
                setIsOnline(msg.data.is_online);
                setConnectionMessage(msg.data.connection_message);
                setLatencyMs(msg.data.server_latency_ms || 0);
                setVaults(msg.data.vaults || []);
                setMissingFolders(msg.data.missing_folders || []);
                setPendingQueueCount(msg.data.pending_queue_count || 0);
                setActivityLogs(msg.data.activity_logs || []);
                break;

              case 'connection_status':
                setIsOnline(msg.data.is_online);
                setConnectionMessage(msg.data.message);
                setLatencyMs(msg.data.latency_ms || 0);
                setPendingQueueCount(msg.data.pending_queue_count || 0);
                break;

              case 'vault_update':
                setVaults((prev) => {
                  const idx = prev.findIndex((v) => v.vault_id === msg.data.vault_id);
                  if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = { ...next[idx], ...msg.data };
                    return next;
                  }
                  return [msg.data, ...prev];
                });
                break;

              case 'vault_removed':
                setVaults((prev) => prev.filter((v) => v.vault_id !== msg.data.vault_id));
                setMissingFolders((prev) => prev.filter((m) => m.vault_id !== msg.data.vault_id));
                break;

              case 'missing_folder_alert':
                setMissingFolders((prev) => {
                  if (prev.some((m) => m.vault_id === msg.data.vault_id)) return prev;
                  return [...prev, msg.data];
                });
                break;

              case 'missing_folder_resolved':
                setMissingFolders((prev) => prev.filter((m) => m.vault_id !== msg.data.vault_id));
                break;

              case 'log':
                setActivityLogs((prev) => [msg.data, ...prev.slice(0, 99)]);
                break;

              default:
                break;
            }
          } catch (err) {
            console.error('Error handling WebSocket message', err);
          }
        };

        ws.onclose = () => {
          if (unmounted) return;
          setIsWsConnected(false);
          setIsOnline(false);
          setConnectionMessage('Client daemon disconnected. Reconnecting in 3s...');
          reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (e) {
        if (!unmounted) {
          reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
        }
      }
    }

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return {
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
  };
}
