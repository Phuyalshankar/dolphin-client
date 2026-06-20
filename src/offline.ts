export interface OfflineMutation {
  id?: number;
  method: string;
  path: string;
  payload: any;
  timestamp: number;
}

export class DolphinOffline {
  client: any;
  db: any;
  isOnline: boolean;
  private memoryCache = new Map<string, any>();
  private memoryMutations: OfflineMutation[] = [];

  constructor(client: any) {
    this.client = client;
    this.isOnline = (typeof window !== 'undefined' && typeof navigator !== 'undefined') ? navigator.onLine : true;
    this.initDB();
    this.setupNetworkListeners();
  }

  private initDB() {
    if (typeof indexedDB === 'undefined') return;
    try {
      const request = indexedDB.open('dolphin_offline', 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache');
        }
        if (!db.objectStoreNames.contains('mutations')) {
          db.createObjectStore('mutations', { keyPath: 'id', autoIncrement: true });
        }
      };
      request.onsuccess = (e: any) => {
        this.db = e.target.result;
        if (this.isOnline) {
          this.syncMutations();
        }
      };
    } catch (err) {
      console.warn('[Dolphin Offline] Failed to initialize IndexedDB:', err);
    }
  }

  private setupNetworkListeners() {
    if (typeof window === 'undefined') return;
    this.client.addDomListener(window, 'online', () => {
      this.isOnline = true;
      this.client._dispatch('network:status', { online: true });
      this.syncMutations();
    });
    this.client.addDomListener(window, 'offline', () => {
      this.isOnline = false;
      this.client._dispatch('network:status', { online: false });
    });
  }

  async getCache(key: string): Promise<any> {
    if (!this.db) {
      return this.memoryCache.get(key);
    }
    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction('cache', 'readonly');
        const store = transaction.objectStore('cache');
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async setCache(key: string, data: any): Promise<void> {
    if (!this.db) {
      this.memoryCache.set(key, data);
      return;
    }
    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction('cache', 'readwrite');
        const store = transaction.objectStore('cache');
        store.put({ data, timestamp: Date.now() }, key);
        transaction.oncomplete = () => resolve();
        // @fix: Handle write errors so callers aren't silently misled (was: no error handler)
        transaction.onerror = () => {
          console.warn('[Dolphin Offline] setCache write failed for key:', key);
          resolve();
        };
      } catch {
        resolve();
      }
    });
  }

  async queueMutation(method: string, path: string, payload: any): Promise<void> {
    const mutation: OfflineMutation = {
      method,
      path,
      payload,
      timestamp: Date.now()
    };

    if (!this.db) {
      this.memoryMutations.push(mutation);
      return;
    }

    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction('mutations', 'readwrite');
        const store = transaction.objectStore('mutations');
        store.add(mutation);
        transaction.oncomplete = () => resolve();
        // @fix: Handle write errors explicitly (was: no error handler, mutation silently lost)
        transaction.onerror = () => {
          console.warn('[Dolphin Offline] queueMutation write failed:', method, path);
          // Fallback to memory queue so mutation is not completely lost
          this.memoryMutations.push(mutation);
          resolve();
        };
      } catch {
        resolve();
      }
    });
  }

  async getMutations(): Promise<OfflineMutation[]> {
    if (!this.db) {
      return [...this.memoryMutations];
    }
    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction('mutations', 'readonly');
        const store = transaction.objectStore('mutations');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  async removeMutation(id: number): Promise<void> {
    if (!this.db) {
      this.memoryMutations = this.memoryMutations.filter(m => m.id !== id);
      return;
    }
    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction('mutations', 'readwrite');
        const store = transaction.objectStore('mutations');
        store.delete(id);
        transaction.oncomplete = () => resolve();
        // @fix: Log error but still resolve so sync loop isn't permanently blocked
        transaction.onerror = () => {
          console.warn('[Dolphin Offline] removeMutation failed for id:', id);
          resolve();
        };
      } catch {
        resolve();
      }
    });
  }

  async syncMutations(): Promise<void> {
    const mutations = await this.getMutations();
    if (mutations.length === 0) return;

    if (this.client.options?.debug) {
      console.log(`[Dolphin Offline] Syncing ${mutations.length} queued mutations...`);
    }

    for (const mutation of mutations) {
      try {
        // Send request directly to bypass interceptor
        await this.client.api.requestDirect(mutation.method, mutation.path, mutation.payload);
        
        if (mutation.id !== undefined) {
          await this.removeMutation(mutation.id);
        } else {
          this.memoryMutations.shift();
        }
      } catch (err) {
        console.error(`[Dolphin Offline] Sync failed for mutation ${mutation.method} ${mutation.path}:`, err);
        if (err && (err as any).status && (err as any).status >= 400 && (err as any).status < 500) {
          console.warn('[Dolphin Offline] Discarding invalid mutation.');
          if (mutation.id !== undefined) {
            await this.removeMutation(mutation.id);
          } else {
            this.memoryMutations.shift();
          }
        } else {
          break; // server/network error, halt sync and try later
        }
      }
    }
  }
}

export function attachOffline(clientProto: any) {
  clientProto._initOffline = function() {
    this.offline = new DolphinOffline(this);
  };
}
