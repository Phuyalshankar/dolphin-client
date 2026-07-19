import { APIHandler } from './api';
import { AuthHandler } from './auth';
import { DolphinStore } from './store';
import type {
    DolphinClientOptions,
    StorageAdapter,
    AttachedListener,
    TopicCallback,
    SignalMessage,
    FileMetadata,
    BinaryFrame,
} from './types';

export class DolphinClient {
    host: string;
    httpUrl: string;
    deviceId: string;
    options: DolphinClientOptions;
    socket: WebSocket | null;
    storage: StorageAdapter;
    accessToken: string | null;
    api: APIHandler;
    auth: AuthHandler;
    store: DolphinStore;
    handlers: Map<string, Set<TopicCallback>>;
    signalHandlers: Set<(msg: SignalMessage) => void>;
    fileHandlers: Set<(meta: FileMetadata) => void>;
    _offlineQueue: string[];
    reconnectAttempts: number;
    /** @fix: Store timer ID so disconnect() can cancel pending reconnects (was: memory/logic leak) */
    _reconnectTimer: ReturnType<typeof setTimeout> | null;
    _attachedListeners: AttachedListener[];

    constructor(
        urlArg: string | Partial<DolphinClientOptions> = '',
        deviceIdArg: string | Partial<DolphinClientOptions> = '',
        optionsArg: Partial<DolphinClientOptions> = {}
    ) {
        let url = typeof urlArg === 'string' ? urlArg : '';
        let deviceId = typeof deviceIdArg === 'string' ? deviceIdArg : '';
        let options = optionsArg;

        if (typeof urlArg === 'object' && urlArg !== null) {
            options = urlArg;
        } else if (typeof deviceIdArg === 'object' && deviceIdArg !== null) {
            options = deviceIdArg;
        }

        if (!url && typeof window !== 'undefined') url = window.location.host;

        let protocol = 'http:';
        if      (url.startsWith('https://')) protocol = 'https:';
        else if (url.startsWith('http://'))  protocol = 'http:';
        else if (typeof window !== 'undefined') protocol = window.location.protocol;

        this.host    = (url || 'localhost').replace(/\/$/, '').replace(/^https?:\/\//, '');
        this.httpUrl = `${protocol}//${this.host}`;

        // @fix: Use crypto.randomUUID() for collision-resistant, non-deprecated ID generation
        this.deviceId = deviceId || (
            typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function'
                ? 'web_' + (crypto as any).randomUUID().replace(/-/g, '').slice(0, 8)
                : 'web_' + Math.random().toString(36).slice(2, 10)
        );

        /** @type {DolphinClientOptions} */
        this.options = {
            timeout:          15000,
            chunkSize:        65536,   // 64 KB
            maxReconnect:     5,
            autoRefreshToken: true,
            debug:            false,
            methodSpoofing:   false,
            routerViewport:   'main, #viewport, body',
            routerTransitions: true,
            // @fix: Default to 'hash' routing so CDN/static hosting works with zero config.
            // Hash URLs (#/register) are never sent to the server, so no _redirects or 404.html needed.
            // Set routerMode: 'history' to use clean pushState URLs (requires server-side fallback).
            routerMode:       'hash',
            ...options,
        };

        // @fix: Auto-inject <base href="/"> so all relative asset paths (./script.js, ./components/x.html)
        // always resolve from the site root, regardless of the current URL path or hash.
        if (typeof document !== 'undefined' && !document.querySelector('base')) {
            const base = document.createElement('base');
            base.href = (typeof window !== 'undefined' && window.location && window.location.origin ? window.location.origin : '') + '/';
            if (document.head) {
                document.head.insertBefore(base, document.head.firstChild);
            }
        }

        /** @type {WebSocket|null} */
        this.socket = null;

        // Storage polyfill
        this.storage = typeof localStorage !== 'undefined' ? localStorage : {
            getItem:    () => null,
            setItem:    () => {},
            removeItem: () => {},
        };

        /** @type {string|null} */
        this.accessToken = this.storage.getItem('dolphin_token');

        // Sub-handlers
        this.api   = new APIHandler(this);
        this.auth  = new AuthHandler(this);
        this.store = new DolphinStore(this);

        /** @type {Map<string, Set<TopicCallback>>} */
        this.handlers       = new Map();
        /** @type {Set<function(SignalMessage): void>} */
        this.signalHandlers = new Set();
        /** @type {Set<function(FileMetadata): void>} */
        this.fileHandlers   = new Set();

        /** @type {Array<string>} — offline message queue */
        this._offlineQueue  = [];

        this.reconnectAttempts = 0;
        this._reconnectTimer   = null;
        this._attachedListeners = [];

        // Initialize DOM bindings automatically if running in browser
        if (typeof window !== 'undefined' && typeof (this as any)._initDOMBinding === 'function') {
            (this as any)._initDOMBinding();
        }

        // Initialize offline persistence automatically
        if (typeof (this as any)._initOffline === 'function') {
            (this as any)._initOffline();
        }

        // Initialize accessibility (a11y) shortcuts
        if (typeof (this as any)._initA11y === 'function') {
            (this as any)._initA11y();
        }

        // Initialize internationalization (i18n) translation engine
        if (typeof (this as any)._initI18n === 'function') {
            (this as any)._initI18n();
        }

        // Initialize drag-drop and sortable lists listeners
        if (typeof (this as any)._initDragDrop === 'function') {
            (this as any)._initDragDrop();
        }

        // Initialize realtime collaborative editor cursors
        if (typeof (this as any)._initCollab === 'function') {
            (this as any)._initCollab();
        }
    }

    /** Save or clear the access token */
    setToken(token) {
        this.accessToken = token;
        token
            ? this.storage.setItem('dolphin_token', token)
            : this.storage.removeItem('dolphin_token');
    }

    // ── WebSocket ─────────────────────────────────────────────────────────────

    /** Connect to the Dolphin realtime server */
    async connect() {
        // @fix: Guard against duplicate sockets — skip if already OPEN or CONNECTING (was: socket leak)
        if (this.socket && (
            this.socket.readyState === WebSocket.OPEN ||
            this.socket.readyState === WebSocket.CONNECTING
        )) {
            return Promise.resolve();
        }

        return new Promise<void>((resolve, reject) => {
            const protocol = this.httpUrl.startsWith('https') ? 'wss:' : 'ws:';
            const wsUrl    = `${protocol}//${this.host}/realtime?deviceId=${this.deviceId}`;

            if (this.options.debug) console.log(`[Dolphin] Connecting to ${wsUrl}...`);
            this.socket = new WebSocket(wsUrl);
            // Enable binary frame reception for ESP8266 / IoT binary protocol
            this.socket.binaryType = 'arraybuffer';

            this.socket.onopen = () => {
                if (this.options.debug) console.log(`[Dolphin] Connected as "${this.deviceId}" 🐬`);
                this.reconnectAttempts = 0;
                this._flushOfflineQueue();
                resolve();
            };
            this.socket.onmessage = (ev) => this._handleMessage(ev.data);
            this.socket.onclose   = () => {
                if (this.options.debug) console.warn('[Dolphin] Connection closed');
                this._maybeReconnect();
            };
            this.socket.onerror = (err) => {
                if (this.options.debug) console.error('[Dolphin] WebSocket error:', err);
                reject(err);
            };
        });
    }

    /** Disconnect cleanly */
    disconnect() {
        // @fix: Cancel any pending reconnect timer before closing (was: timer continued after disconnect)
        if (this._reconnectTimer !== null) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
        if (this.socket) {
            this.socket.onclose = null; // prevent auto-reconnect
            this.socket.close();
            this.socket = null;
        }
        // @fix: Cleanup collab cursor elements and stale timers on disconnect
        if (typeof (this as any)._collabCleanup === 'function') {
            (this as any)._collabCleanup();
        }
        this.cleanupDomListeners();
    }

    /**
     * Decode a binary WebSocket frame from ESP8266 / IoT devices.
     *
     * Frame format:
     *   [1 byte TYPE][1 byte TOPIC_LEN][TOPIC_LEN bytes topic][...payload]
     *
     * TYPE values:
     *   0x01 = string  → [2 bytes len][utf8 bytes]           → { value: string }
     *   0x02 = float32 → [4 bytes IEEE-754 big-endian]       → { value: number }
     *   0x03 = uint16  → [2 bytes big-endian]                → { value: number }
     *   0x04 = int16   → [2 bytes signed big-endian]         → { value: number }
     *   0x05 = uint8   → [1 byte]                            → { value: number }
     *   0x06 = JSON    → [2 bytes len][utf8 json bytes]      → parsed object
     *   0x07 = multi   → [1 byte count][[1B klen][key][4B f32]...] → { key: value }
     *
     * Arduino/ESP8266 example (float32):
     *   void sendF32(const char* topic, float v) {
     *     uint8_t tl = strlen(topic);
     *     uint8_t buf[2 + tl + 4];
     *     buf[0] = 0x02; buf[1] = tl;
     *     memcpy(&buf[2], topic, tl);
     *     union { float f; uint8_t b[4]; } u; u.f = v;
     *     buf[2+tl]=u.b[3]; buf[3+tl]=u.b[2]; buf[4+tl]=u.b[1]; buf[5+tl]=u.b[0];
     *     webSocket.sendBIN(buf, sizeof(buf));
     *   }
     * @private
     */
    _decodeBinary(buf: ArrayBuffer): { topic: string; payload: any } | null {
        if (buf.byteLength < 2) return null;
        const view = new DataView(buf);
        const u8   = new Uint8Array(buf);
        const type = view.getUint8(0);
        const topicLen = view.getUint8(1);
        if (buf.byteLength < 2 + topicLen) return null;
        const topic = new TextDecoder().decode(u8.slice(2, 2 + topicLen));
        const off = 2 + topicLen;
        let payload: any;
        switch (type) {
            case 0x01: { // string
                if (buf.byteLength < off + 2) return null;
                const slen = view.getUint16(off, false);
                if (buf.byteLength < off + 2 + slen) return null;
                payload = { value: new TextDecoder().decode(u8.slice(off + 2, off + 2 + slen)) };
                break;
            }
            case 0x02: // float32
                if (buf.byteLength < off + 4) return null;
                payload = { value: Math.round(view.getFloat32(off, false) * 1000) / 1000 };
                break;
            case 0x03: // uint16
                if (buf.byteLength < off + 2) return null;
                payload = { value: view.getUint16(off, false) };
                break;
            case 0x04: // int16
                if (buf.byteLength < off + 2) return null;
                payload = { value: view.getInt16(off, false) };
                break;
            case 0x05: // uint8
                if (buf.byteLength < off + 1) return null;
                payload = { value: view.getUint8(off) };
                break;
            case 0x06: { // JSON
                if (buf.byteLength < off + 2) return null;
                const jlen = view.getUint16(off, false);
                if (buf.byteLength < off + 2 + jlen) return null;
                try { payload = JSON.parse(new TextDecoder().decode(u8.slice(off + 2, off + 2 + jlen))); }
                catch { return null; }
                break;
            }
            case 0x07: { // multi-float (multiple sensor values in one frame)
                if (buf.byteLength < off + 1) return null;
                const count = view.getUint8(off);
                payload = {};
                let cursor = off + 1;
                for (let i = 0; i < count; i++) {
                    if (buf.byteLength < cursor + 1) break;
                    const klen = view.getUint8(cursor++);
                    if (buf.byteLength < cursor + klen + 4) break;
                    const key = new TextDecoder().decode(u8.slice(cursor, cursor + klen));
                    cursor += klen;
                    payload[key] = Math.round(view.getFloat32(cursor, false) * 1000) / 1000;
                    cursor += 4;
                }
                break;
            }
            default: return null;
        }
        return { topic, payload };
    }

    /** @private */
    _handleMessage(data) {
        // ── Binary protocol (ESP8266 / IoT) ──────────────────────────────────
        if (data instanceof ArrayBuffer) {
            const decoded = this._decodeBinary(data);
            if (decoded) {
                if (this.options.debug) {
                    console.log('%c📥 [Dolphin Binary]:', 'color: #22d3ee; font-weight: bold;', decoded);
                }
                this.handlers.forEach((cbs, pattern) => {
                    if (this._matchTopic(pattern, decoded.topic)) {
                        cbs.forEach(cb => cb(decoded.payload, decoded.topic));
                    }
                });
            }
            return;
        }
        try {
            const msg = JSON.parse(data);
            if (this.options.debug) {
                console.log('%c📥 [Dolphin WS Incoming]:', 'color: #eab308; font-weight: bold;', msg);
            }

            // Signaling
            if (msg.type && msg.from && (msg.to === this.deviceId || msg.to === 'all')) {
                if (msg.msgId && msg.type !== 'ACK') this._sendAck(msg.from, msg.msgId);
                this.signalHandlers.forEach(h => h(msg));
            }

            // File events
            if (msg.type === 'FILE_AVAILABLE') {
                this.fileHandlers.forEach(h => h(msg));
            }
            if (msg.type === 'FILE_CHUNK') {
                this.saveFileProgress(msg.fileId, msg.chunkIndex);
                this._dispatch('file:chunk', msg);
                this._dispatch(`file:chunk/${msg.fileId}`, msg);
            }
            if (msg.type === 'FILE_UPLOAD_ACK') {
                this._dispatch(`file:upload:ack/${msg.fileId}`, msg);
            }

            // Pull response
            if (msg.type === 'PULL_RESPONSE') {
                this._dispatch('pull:response', msg.payload, msg.topic);
                this._dispatch(`pull:response/${msg.topic}`, msg.payload, msg.topic);
            }

            // Pub/Sub
            if (msg.topic && msg.payload !== undefined) {
                this.handlers.forEach((cbs, pattern) => {
                    if (this._matchTopic(pattern, msg.topic)) {
                        cbs.forEach(cb => cb(msg.payload, msg.topic));
                    }
                });
            }
        } catch {
            this._dispatch('raw', data);
        }
    }

    /** @private */
    _dispatch(pattern, payload, topic?) {
        const cbs = this.handlers.get(pattern);
        if (cbs) cbs.forEach(cb => cb(payload, topic || pattern));
    }

    /** @private */
    _sendRaw(msg) {
        if (this.options.debug) {
            console.log('%c📤 [Dolphin WS Outgoing]:', 'color: #8b5cf6; font-weight: bold;', msg);
        }
        const str = typeof msg === 'string' ? msg : JSON.stringify(msg);
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(str);
        } else {
            // Buffer for offline queue (max 100 messages)
            if (this._offlineQueue.length < 100) this._offlineQueue.push(str);
        }
    }

    /** Flush buffered messages after reconnect @private */
    _flushOfflineQueue() {
        while (this._offlineQueue.length > 0) {
            const msg = this._offlineQueue.shift();
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(msg);
            }
        }
    }

    /** @private */
    _sendAck(to, msgId) {
        this._sendRaw({ type: 'ACK', from: this.deviceId, to, data: { ackId: msgId }, timestamp: Date.now() });
    }

    /** MQTT wildcard topic matching @private */
    _matchTopic(pattern, topic) {
        if (pattern === topic || pattern === '#') return true;
        const pp = pattern.split('/');
        const tp = topic.split('/');
        if (pp.length !== tp.length && !pattern.includes('#')) return false;
        for (let i = 0; i < pp.length; i++) {
            if (pp[i] === '#') return true;
            if (pp[i] !== '+' && pp[i] !== tp[i]) return false;
        }
        return pp.length === tp.length;
    }

    /** @private */
    _maybeReconnect() {
        if (this.reconnectAttempts < this.options.maxReconnect) {
            this.reconnectAttempts++;
            const delay = Math.pow(2, this.reconnectAttempts) * 1000;
            if (this.options.debug) console.log(`[Dolphin] Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts})...`);
            // @fix: Store timer ID so disconnect() can cancel it (was: timer fired after explicit disconnect)
            this._reconnectTimer = setTimeout(() => {
                this._reconnectTimer = null;
                this.connect().catch(() => {});
            }, delay);
        } else {
            if (this.options.debug) console.error('[Dolphin] Max reconnect attempts reached.');
        }
    }

    // ── Pub/Sub ───────────────────────────────────────────────────────────────

    /**
     * Subscribe to a topic (MQTT wildcards supported: + and #).
     * @param {string}        topic
     * @param {TopicCallback} callback
     */
    subscribe(topic, callback) {
        if (!this.handlers.has(topic)) {
            this.handlers.set(topic, new Set());
            this._sendRaw({ type: 'sub', topic });
        }
        this.handlers.get(topic).add(callback);
    }

    /**
     * Unsubscribe from a topic.
     * @param {string}        topic
     * @param {TopicCallback} callback
     */
    unsubscribe(topic, callback) {
        if (this.handlers.has(topic)) {
            const cbs = this.handlers.get(topic);
            cbs.delete(callback);
            if (cbs.size === 0) {
                this.handlers.delete(topic);
                this._sendRaw({ type: 'unsub', topic });
            }
        }
    }

    /**
     * Publish a message to a topic, render matching local bindings immediately,
     * then send the message to the realtime server. The outbound message is
     * queued if the socket is offline.
     * @param {string} topic
     * @param {any}    payload
     */
    publish(topic, payload) {
        // Optimistic local render: supports object and array payloads, including
        // declarative templates, filters, searches, and sorts.
        (this as any)._updateDOM?.(topic, payload);

        this._sendRaw({ topic, payload });
    }

    /**
     * High-frequency data push (IoT sensors).
     * @param {string} topic
     * @param {any}    payload
     */
    pubPush(topic, payload) {
        this._sendRaw({ type: 'pub', topic, payload });
    }

    /**
     * Send a binary float32 frame to an ESP8266 / IoT device.
     * Encodes: [0x02][topicLen][topic][float32 big-endian]
     *
     * ESP8266 Arduino receive example:
     *   webSocket.onEvent([](uint8_t num, WStype_t type, uint8_t* payload, size_t len) {
     *     if (type == WStype_BIN && len >= 2) {
     *       uint8_t tl = payload[1];
     *       // topic = payload[2..2+tl]
     *       union { uint8_t b[4]; float f; } u;
     *       u.b[3]=payload[2+tl]; u.b[2]=payload[3+tl];
     *       u.b[1]=payload[4+tl]; u.b[0]=payload[5+tl];
     *       float value = u.f; // use value
     *     }
     *   });
     *
     * @param {string} topic
     * @param {number} value  - float32 value (e.g. 1.0 to set brightness)
     */
    publishBinary(topic: string, value: number): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.warn('[Dolphin] publishBinary: WebSocket not connected');
            return;
        }
        const topicBytes = new TextEncoder().encode(topic);
        const buf = new ArrayBuffer(2 + topicBytes.length + 4);
        const view = new DataView(buf);
        const u8   = new Uint8Array(buf);
        view.setUint8(0, 0x02);                         // TYPE: float32
        view.setUint8(1, topicBytes.length);             // topic length
        u8.set(topicBytes, 2);                           // topic bytes
        view.setFloat32(2 + topicBytes.length, value, false); // big-endian float
        this.socket.send(buf);
    }

    /**
     * Request historical data from a topic.
     * @param {string} topic
     * @param {number} [count=10]
     */
    subPull(topic, count = 10) {
        this._sendRaw({ type: 'PULL_REQUEST', topic, count });
    }

    // ── File Transfer ─────────────────────────────────────────────────────────

    /**
     * Upload a file to the server in chunks.
     * @param {string}   fileId
     * @param {Blob|ArrayBuffer|Uint8Array} fileData
     * @param {string}   [filename]
     * @param {function(number): void} [onProgress]  — progress callback (0-100)
     * @returns {Promise<void>}
     */
    async pubFile(fileId, fileData, filename = '', onProgress?) {
        let buffer;
        if (fileData instanceof Blob) {
            buffer = await fileData.arrayBuffer();
        } else if (fileData instanceof ArrayBuffer) {
            buffer = fileData;
        } else {
            buffer = (fileData as any).buffer || fileData;
        }

        const bytes      = new Uint8Array(buffer);
        const chunkSize  = this.options.chunkSize;
        const totalChunks = Math.ceil(bytes.length / chunkSize);

        // Send file metadata first
        this._sendRaw({
            type:        'FILE_UPLOAD_START',
            fileId,
            name:        filename,
            size:        bytes.length,
            totalChunks,
            chunkSize,
        });

        for (let i = 0; i < totalChunks; i++) {
            const chunk    = bytes.slice(i * chunkSize, (i + 1) * chunkSize);
            const b64      = this._uint8ToBase64(chunk);

            this._sendRaw({
                type:        'FILE_UPLOAD_CHUNK',
                fileId,
                chunkIndex:  i,
                totalChunks,
                data:        b64,
            });

            if (onProgress) onProgress(Math.round(((i + 1) / totalChunks) * 100));

            // Small yield to prevent blocking
            if (i % 10 === 0) await new Promise(r => setTimeout(r, 0));
        }

        this._sendRaw({ type: 'FILE_UPLOAD_DONE', fileId });
    }

    /** @private */
    _uint8ToBase64(uint8) {
        let binary = '';
        for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
        if (typeof btoa !== 'undefined') return btoa(binary);
        return Buffer.from(binary, 'binary').toString('base64');
    }

    /**
     * Download a file from the server by chunks.
     * @param {string} fileId
     * @param {number} [startChunk=0]
     */
    subFile(fileId, startChunk = 0) {
        this._sendRaw({ type: 'FILE_REQUEST', fileId, startChunk });
    }

    /**
     * Resume a file download from saved progress.
     * @param {string} fileId
     */
    resumeFile(fileId) {
        const last = parseInt(this.storage.getItem(`dolphin_file_${fileId}`) || '-1');
        this.subFile(fileId, last + 1);
    }

    /**
     * Save download chunk progress.
     * @param {string} fileId
     * @param {number} chunkIndex
     */
    saveFileProgress(fileId, chunkIndex) {
        this.storage.setItem(`dolphin_file_${fileId}`, chunkIndex.toString());
    }

    // ── Signaling ─────────────────────────────────────────────────────────────

    /**
     * @param {function(SignalMessage): void} handler
     */
    onSignal(handler)    { this.signalHandlers.add(handler); }

    /**
     * @param {function(SignalMessage): void} handler
     */
    offSignal(handler)   { this.signalHandlers.delete(handler); }

    /**
     * @param {function(FileMetadata): void} handler
     */
    onFileAvailable(handler)  { this.fileHandlers.add(handler); }

    /**
     * @param {function(FileMetadata): void} handler
     */
    offFileAvailable(handler) { this.fileHandlers.delete(handler); }

    addDomListener(target: any, event: string, cb: any) {
        if (!target) return;
        target.addEventListener(event, cb);
        this._attachedListeners = this._attachedListeners || [];
        this._attachedListeners.push({ target, event, cb });
    }

    cleanupDomListeners() {
        if (this._attachedListeners) {
            this._attachedListeners.forEach(({ target, event, cb }: any) => {
                try {
                    target.removeEventListener(event, cb);
                } catch {}
            });
            this._attachedListeners = [];
        }
    }
}
