// ============================================================
//  Dolphin Client — Shared TypeScript Interfaces & Types
//  Centralised type definitions to replace `any` across modules
// ============================================================

// ── Client Configuration ─────────────────────────────────────

export interface DolphinClientOptions {
    /** HTTP request timeout in milliseconds (default: 15000) */
    timeout: number;
    /** WebSocket chunk size for file transfers in bytes (default: 65536) */
    chunkSize: number;
    /** Maximum WebSocket reconnect attempts (default: 5) */
    maxReconnect: number;
    /** Auto-refresh JWT token on 401 (default: true) */
    autoRefreshToken: boolean;
    /** Enable verbose debug logging in console (default: false) */
    debug: boolean;
    /** Enable HTTP method spoofing for PHP frameworks (default: false) */
    methodSpoofing: boolean;
    /** CSS selector for SPA viewport container */
    routerViewport: string;
    /** Enable smooth SPA route transitions (default: true) */
    routerTransitions: boolean;
    /** Router mode: 'hash' for CDN/static, 'history' for server-side fallback */
    routerMode: 'hash' | 'history';
    /** Auto-broadcast REST mutations via WebSocket topic (default: false) */
    autoBroadcast?: boolean;
    /** Enable PWA service worker (default: false) */
    pwa?: boolean;
    /** Template cache enabled (default: true) */
    templateCache?: boolean;
    /** WebSocket heartbeat interval in ms */
    wsHeartbeat?: number;
}

// ── WebSocket / Pub-Sub ──────────────────────────────────────

export type TopicCallback = (payload: any, topic: string) => void;

export interface SignalMessage {
    type: string;
    from: string;
    to: string;
    msgId?: string;
    data?: any;
    timestamp?: number;
}

export interface FileMetadata {
    type: 'FILE_AVAILABLE';
    fileId: string;
    name: string;
    size: number;
    totalChunks: number;
}

export interface BinaryFrame {
    topic: string;
    payload: Record<string, any> | { value: string | number };
}

// ── Storage Polyfill ─────────────────────────────────────────

export interface StorageAdapter {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

// ── Attached DOM Listener (for cleanup) ──────────────────────

export interface AttachedListener {
    target: EventTarget;
    event: string;
    cb: EventListenerOrEventListenerObject;
}

// ── API Handler ──────────────────────────────────────────────

export interface RequestOptions {
    headers?: Record<string, string>;
    _isRetry?: boolean;
    methodSpoofing?: boolean;
    signal?: AbortSignal;
    [key: string]: any;
}

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

export interface NormalizedErrors {
    [field: string]: string;
}

// ── Auth ─────────────────────────────────────────────────────

export interface LoginResponse {
    accessToken?: string;
    user?: Record<string, any>;
    [key: string]: any;
}

export interface TwoFASetupResponse {
    qrUrl?: string;
    secret?: string;
    [key: string]: any;
}

// ── Offline Module ───────────────────────────────────────────

export interface OfflineMutation {
    id?: number;
    method: string;
    path: string;
    payload: any;
    timestamp: number;
}

// ── UI Store ─────────────────────────────────────────────────

export type UIStoreMap = Map<string, Record<string, any>>;

// ── DataEngine Collection ─────────────────────────────────────

export interface CollectionState<T = any> {
    _rawItems: T[];
    items: T[];
    loading: boolean;
    error: string | null;
    success: boolean;
}
