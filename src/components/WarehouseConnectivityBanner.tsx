import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Database, ShieldAlert, Cpu } from 'lucide-react';
import { getOfflineOutbox, flushOfflineOutbox } from '../lib/offlineRepairStorage';

interface WarehouseConnectivityBannerProps {
  isOnline: boolean;
  isSimulatedOffline: boolean;
  onToggleSimulateOffline: () => void;
  onSyncCompleted?: () => void;
}

export const WarehouseConnectivityBanner: React.FC<WarehouseConnectivityBannerProps> = ({
  isOnline,
  isSimulatedOffline,
  onToggleSimulateOffline,
  onSyncCompleted
}) => {
  const [outboxCount, setOutboxCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [swActive, setSwActive] = useState<boolean>(false);

  useEffect(() => {
    // Check if Service Worker is registered
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      setSwActive(true);
    } else if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => setSwActive(true)).catch(() => {});
    }

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

  return (
    <div className={`w-full border-b-4 border-black transition-colors ${
      !isOnline 
        ? 'bg-amber-400 text-black' 
        : 'bg-black text-white'
    }`}>
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-black">
        {/* Status indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {!isOnline ? (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 bg-black text-amber-400 uppercase tracking-widest text-[11px] border border-black animate-pulse">
                <WifiOff className="w-3.5 h-3.5" />
                WAREHOUSE OFFLINE MODE
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-fugo text-black uppercase tracking-widest text-[10px]">
                <Wifi className="w-3.5 h-3.5 text-black" />
                ONLINE (HIGH CONNECTIVITY)
              </span>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] tracking-wide">
            <span className="opacity-75">
              {!isOnline 
                ? 'Workbox Service Worker serving cached repair records & parts database.'
                : 'Workbox Service Worker active — caching repair data for industrial dead zones.'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Workbox SW Indicator */}
          <div className="flex items-center gap-1 px-2 py-0.5 bg-white/10 text-[10px] uppercase font-mono tracking-wider">
            <Cpu className="w-3 h-3 text-fugo" />
            <span className="hidden md:inline">WORKBOX SW:</span>
            <span className={swActive ? 'text-fugo' : 'text-gray-400'}>
              {swActive ? 'CACHING READY' : 'REGISTERING'}
            </span>
          </div>

          {/* Pending Outbox Sync */}
          {outboxCount > 0 && (
            <button
              onClick={handleManualSync}
              disabled={isSyncing || !isOnline}
              className={`flex items-center gap-1.5 px-3 py-1 text-[11px] uppercase tracking-wider font-black transition-all ${
                isOnline
                  ? 'bg-fugo text-black hover:bg-white hover:text-black border border-black'
                  : 'bg-black/80 text-white cursor-not-allowed opacity-80'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>
                {isSyncing 
                  ? 'SYNCING...' 
                  : `${outboxCount} QUEUED ${isOnline ? '— SYNC NOW' : '(WAITING FOR SIGNAL)'}`}
              </span>
            </button>
          )}

          {/* Simulate Warehouse Dead Zone Toggle */}
          <button
            onClick={onToggleSimulateOffline}
            title="Toggle simulated warehouse low connectivity to test offline repair caching"
            className={`px-2.5 py-1 text-[10px] uppercase tracking-widest transition-colors border ${
              isSimulatedOffline
                ? 'bg-red-600 text-white border-black font-black'
                : 'bg-neutral-800 text-white hover:bg-neutral-700 border-white/20'
            }`}
          >
            {isSimulatedOffline ? 'EXIT DEAD ZONE SIMULATION' : 'SIMULATE WAREHOUSE DEAD ZONE'}
          </button>
        </div>
      </div>
    </div>
  );
};
