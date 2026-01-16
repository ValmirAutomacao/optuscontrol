import { useEffect, useState } from 'react';
import { Network } from '@capacitor/network';
import { db } from '../lib/offlineDb';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export function useOfflineSync() {
    const [isOnline, setIsOnline] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        // Inicializar status da rede
        Network.getStatus().then(status => setIsOnline(status.connected));

        // Ouvir mudanças na conexão
        const handler = Network.addListener('networkStatusChange', status => {
            setIsOnline(status.connected);
            if (status.connected) {
                syncData();
            }
        });

        return () => {
            handler.then(h => h.remove());
        };
    }, []);

    async function syncData() {
        if (isSyncing) return;
        setIsSyncing(true);

        try {
            await syncMeasurements();
            await syncReceipts();
        } catch (error) {
            console.error('Error during sync:', error);
        } finally {
            setIsSyncing(false);
        }
    }

    async function syncMeasurements() {
        const pending = await db.measurements.where('status').equals('pending_sync').toArray();

        for (const item of pending) {
            try {
                const response = await fetch(`${API_URL}/projects/provisions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        project_id: item.project_id,
                        description: item.description,
                        supplier_name: item.supplier_name,
                        measurement_date: item.measurement_date,
                        expected_amount: 0, // Ajustar conforme necessário
                        status: 'pending'
                    })
                });

                if (response.ok) {
                    await db.measurements.update(item.id!, { status: 'synced' });
                } else {
                    await db.measurements.update(item.id!, { status: 'error', error_message: 'Erro no servidor' });
                }
            } catch (e) {
                console.error('Sync failed for item', item.id);
            }
        }
    }

    async function syncReceipts() {
        const pending = await db.receipts.where('status').equals('pending_sync').toArray();

        for (const item of pending) {
            try {
                const formData = new FormData();

                let fileBlob: Blob | null = null;
                if (item.image_blob) {
                    fileBlob = item.image_blob;
                } else if (item.image_base64) {
                    const res = await fetch(item.image_base64);
                    fileBlob = await res.blob();
                }

                if (!fileBlob) continue;

                formData.append('file', fileBlob, `receipt_${item.id}.jpg`);
                formData.append('company_id', item.company_id);
                if (item.project_id) {
                    formData.append('project_id', item.project_id);
                }

                const response = await fetch(`${API_URL}/receipts/upload`, {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    await db.receipts.update(item.id!, { status: 'synced' });
                } else {
                    await db.receipts.update(item.id!, { status: 'error', error_message: 'Erro no upload' });
                }
            } catch (e) {
                console.error('Sync failed for receipt', item.id);
            }
        }
    }

    return { isOnline, isSyncing, syncData };
}
