import Dexie, { type Table } from 'dexie';

export interface OfflineMeasurement {
    id?: number;
    project_id: string;
    description: string;
    supplier_name: string;
    measurement_date: string;
    status: 'pending_sync' | 'synced' | 'error';
    error_message?: string;
    created_at: string;
}

export interface OfflineReceipt {
    id?: number;
    company_id: string;
    project_id?: string;
    image_blob?: Blob;
    image_base64?: string;
    status: 'pending_sync' | 'synced' | 'error';
    error_message?: string;
    created_at: string;
}

export class OptusOfflineDb extends Dexie {
    measurements!: Table<OfflineMeasurement>;
    receipts!: Table<OfflineReceipt>;

    constructor() {
        super('OptusOfflineDb');
        this.version(1).stores({
            measurements: '++id, project_id, status',
            receipts: '++id, company_id, status'
        });
    }
}

export const db = new OptusOfflineDb();
