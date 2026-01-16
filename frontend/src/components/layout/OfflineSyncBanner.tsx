import { WifiOff, RefreshCw } from 'lucide-react';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import './OfflineSyncBanner.css';

export function OfflineSyncBanner() {
    const { isOnline, isSyncing, syncData } = useOfflineSync();

    if (isOnline && !isSyncing) return null;

    return (
        <div className={`offline-banner ${!isOnline ? 'offline' : 'syncing'}`}>
            <div className="offline-banner-content">
                {!isOnline ? (
                    <>
                        <WifiOff size={16} />
                        <span>Você está offline. Os dados serão salvos localmente.</span>
                    </>
                ) : (
                    <>
                        <RefreshCw size={16} className="spin" />
                        <span>Sincronizando dados com o servidor...</span>
                    </>
                )}
            </div>
            {!isOnline && (
                <button onClick={syncData} className="retry-button">
                    Tentar Sincronizar
                </button>
            )}
        </div>
    );
}
