/**
 * core-entry.ts — Lightweight Dolphin Client entry point.
 *
 * Includes ONLY: WebSocket, Pub/Sub, REST API, Auth, Store (DataEngine).
 * Does NOT include: DOM bindings, SPA Router, VFS, Collab, PWA, i18n,
 * Drag & Drop, Animation, Accessibility, Testing helpers.
 *
 * Use this entry for:
 *  - Server-side rendering (SSR/Node.js)
 *  - WebSocket-only real-time apps
 *  - Bundler users who handle their own DOM rendering (React, Vue, etc.)
 *  - Micro-frontends needing just the data layer
 *
 * Bundle size: ~25KB minified (vs ~72KB for the full bundle)
 *
 * @example
 *   // npm/bundler:
 *   import { DolphinClient } from 'dolphin-client/core'
 *
 *   const client = new DolphinClient('localhost:8000', 'browser-1');
 *   await client.connect();
 *   client.subscribe('chat/messages', (msgs) => { ... });
 */

export { DolphinClient } from './core';
export { APIHandler } from './api';
export { AuthHandler } from './auth';
export { DolphinStore } from './store';
export { DolphinOffline } from './offline';
export type {
    DolphinClientOptions,
    StorageAdapter,
    AttachedListener,
    TopicCallback,
    SignalMessage,
    FileMetadata,
    RequestOptions,
    HTTPMethod,
    OfflineMutation,
    UIStoreMap,
} from './types';
