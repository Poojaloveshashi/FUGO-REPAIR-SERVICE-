import { useEffect, useState } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });

  const [simulatedOffline, setSimulatedOffline] = useState<boolean>(() => {
    return localStorage.getItem('fugo_simulate_warehouse_offline') === 'true';
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleSimulatedOffline = () => {
    const nextVal = !simulatedOffline;
    setSimulatedOffline(nextVal);
    localStorage.setItem('fugo_simulate_warehouse_offline', String(nextVal));
  };

  const effectiveOnline = isOnline && !simulatedOffline;

  return {
    isOnline: effectiveOnline,
    isRealOnline: isOnline,
    isSimulatedOffline: simulatedOffline,
    toggleSimulatedOffline,
  };
}
