import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { getOfflineOutbox, flushOfflineOutbox } from '../lib/offlineRepairStorage';

interface WarehouseConnectivityBannerProps {
  isOnline: boolean;
  onSyncCompleted?: () => void;
}

export const WarehouseConnectivityBanner: React.FC<WarehouseConnectivityBannerProps> = ({
  isOnline,
  onSyncCompleted,
}) => {
  const [outboxCount, setOutboxCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    const checkOutbox = () => {
      setOutboxCount(getOfflineOutbox().length);
    };

    checkOutbox();
    const interval = setInterval(checkOutbox, 3000);
    return () => clearInterval(interval);
  }, []);

  // When coming back online, auto-flush outbox
  useEffect(() => {
    if (isOnline && outboxCount > 0 && !isSyncing) {
      handleManualSync();
    }
  }, [isOnline]);

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await flushOfflineOutbox();
      setOutboxCount(getOfflineOutbox().length);
      if (onSyncCompleted) {
        onSyncCompleted();
      }
    } catch (err) {
      console.error('Failed to sync offline outbox:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isOnline && outboxCount === 0) {
    return null;
  }

  return (
    <div className={`w-full border-b-2 border-black transition-colors ${
      !isOnline 
        ? 'bg-amber-400 text-black' 
        : 'bg-black text-white'
    }`}>
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-xs font-black">
        <div className="flex items-center gap-2">
          {!isOnline ? (
            <>
              <WifiOff className="w-4 h-4 flex-shrink-0" />
              <span className="uppercase tracking-wider">
                Offline Mode • Changes are saved locally and will sync when connected.
              </span>
            </>
          ) : (
            <>
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="uppercase tracking-wider">
                Reconnected • Syncing changes...
              </span>
            </>
          )}
        </div>

        {outboxCount > 0 && (
          <button
            onClick={handleManualSync}
            disabled={isSyncing || !isOnline}
            className={`flex items-center gap-1.5 px-3 py-1 text-[10px] uppercase tracking-wider font-black rounded transition-all ${
              isOnline
                ? 'bg-fugo text-black hover:bg-white'
                : 'bg-black/20 text-black cursor-default'
            }`}
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>
              {isSyncing 
                ? 'Syncing...' 
                : `${outboxCount} update${outboxCount > 1 ? 's' : ''} queued`}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
