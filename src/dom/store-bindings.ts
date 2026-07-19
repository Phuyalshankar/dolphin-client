/**
 * dom/store-bindings.ts — Global reactive UI store bindings.
 * Handles: data-store-write, data-store-read, <dolphin-store>,
 * setStoreState, getStoreState, _scanStoreBinds, _executeStoreAction.
 */

import { escapeRegExp } from './helpers';

// ── DOM query cache for data-store-read elements ──────────────────────────────
// Avoids a full querySelectorAll scan on every setStoreState call.
// Invalidated by MutationObserver when data-store-read elements change.
const _storeReadCache = new Map<string, Element[]>();

function _invalidateStoreReadCache() {
    _storeReadCache.clear();
}

if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
    const _domObserver = new MutationObserver(() => {
        _invalidateStoreReadCache();
    });
    document.addEventListener('DOMContentLoaded', () => {
        _domObserver.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
            attributeFilter: ['data-store-read'],
        });
    }, { once: true });
}

export function attachStoreBindings(clientProto: any) {

    clientProto.setStoreState = function(storeName: string, keyOrVal: any, val?: any, originEl?: Element) {
        this.uiStores = this.uiStores || new Map<string, any>();
        if (typeof keyOrVal === 'string') {
            if (!this.uiStores.has(storeName) || typeof this.uiStores.get(storeName) !== 'object' || Array.isArray(this.uiStores.get(storeName))) {
                this.uiStores.set(storeName, {});
            }
            const store = this.uiStores.get(storeName);
            store[keyOrVal] = val;

            if (this.options.debug) {
                console.log(`%c💾 [Dolphin Store Update]:`, 'color: #ec4899; font-weight: bold;', `${storeName}.${keyOrVal}`, '=', val);
            }

            if (typeof document !== 'undefined') {
                const cacheKey = `${storeName}.${keyOrVal}`;
                let readElements: Element[];
                if (_storeReadCache.has(cacheKey)) {
                    readElements = _storeReadCache.get(cacheKey)!;
                } else {
                    readElements = Array.from(document.querySelectorAll(`[data-store-read="${cacheKey}"]`));
                    _storeReadCache.set(cacheKey, readElements);
                }

                readElements.forEach((el: any) => {
                    if (el === originEl) return;
                    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                        if (el.type === 'checkbox') {
                            el.checked = !!val;
                        } else {
                            el.value = val !== undefined && val !== null ? val : '';
                        }
                    } else {
                        el.textContent = val !== undefined && val !== null ? val : '';
                    }
                });
            }

            this.publish(`store/${storeName}`, store);
            if (typeof this._updateDOM === 'function') {
                this._updateDOM(`store/${storeName}`, store);
                if (typeof document !== 'undefined') {
                    const dependentEls = document.querySelectorAll('[data-rt-filter],[data-rt-search],[data-rt-sort]');
                    dependentEls.forEach((el: any) => {
                        const bindTopic = el.getAttribute('data-rt-bind');
                        if (bindTopic && bindTopic.startsWith('store/')) {
                            const boundStoreName = bindTopic.replace('store/', '');
                            const boundData = this.uiStores ? this.uiStores.get(boundStoreName) : undefined;
                            if (Array.isArray(boundData) ? boundData.length > 0 : (typeof boundData === 'object' && boundData !== null && Object.keys(boundData).length > 0)) {
                                this._updateDOM(bindTopic, boundData);
                            }
                        }
                    });
                }
            }

            // LocalStorage Auto-Persistence check
            if (typeof document !== 'undefined') {
                const storeEl = document.querySelector(`dolphin-store[name="${storeName}"], dolphin-store[data-store="${storeName}"]`);
                if (storeEl && storeEl.getAttribute('data-persist') === 'true') {
                    try { localStorage.setItem(`dolphin_store_${storeName}`, JSON.stringify(store)); } catch {}
                }
            }
        } else {
            // Direct Object or Array store (identical to DB API store data)
            this.uiStores.set(storeName, keyOrVal);
            if (this.options.debug) {
                console.log(`%c💾 [Dolphin Direct Store Update]:`, 'color: #ec4899; font-weight: bold;', `${storeName}`, '=', keyOrVal);
            }
            this.publish(`store/${storeName}`, keyOrVal);
            if (typeof this._updateDOM === 'function') {
                this._updateDOM(`store/${storeName}`, keyOrVal);
                if (typeof document !== 'undefined') {
                    const dependentEls = document.querySelectorAll('[data-rt-filter],[data-rt-search],[data-rt-sort]');
                    dependentEls.forEach((el: any) => {
                        const bindTopic = el.getAttribute('data-rt-bind');
                        if (bindTopic && bindTopic.startsWith('store/')) {
                            const boundStoreName = bindTopic.replace('store/', '');
                            const boundData = this.uiStores ? this.uiStores.get(boundStoreName) : undefined;
                            if (Array.isArray(boundData) ? boundData.length > 0 : (typeof boundData === 'object' && boundData !== null && Object.keys(boundData).length > 0)) {
                                this._updateDOM(bindTopic, boundData);
                            }
                        }
                    });
                }
            }

            // LocalStorage Auto-Persistence check
            if (typeof document !== 'undefined') {
                const storeEl = document.querySelector(`dolphin-store[name="${storeName}"], dolphin-store[data-store="${storeName}"]`);
                if (storeEl && storeEl.getAttribute('data-persist') === 'true') {
                    try { localStorage.setItem(`dolphin_store_${storeName}`, JSON.stringify(keyOrVal)); } catch {}
                }
            }
        }
    };

    clientProto.getStoreState = function(storeName: string, key?: string) {
        this.uiStores = this.uiStores || new Map<string, any>();
        const store = this.uiStores.get(storeName);
        if (!key) return store;
        return (store && typeof store === 'object') ? store[key] : undefined;
    };

    clientProto.resetStoreState = function(storeName: string) {
        this._initialStores = this._initialStores || new Map<string, any>();
        if (this._initialStores.has(storeName)) {
            const initialVal = JSON.parse(JSON.stringify(this._initialStores.get(storeName)));
            this.setStoreState(storeName, initialVal);
            if (this.options.debug) {
                console.log(`%c🔄 [Dolphin Store Reset]:`, 'color: #3b82f6; font-weight: bold;', `${storeName}`, 'reverted to initial value');
            }
        } else {
            console.warn(`[Dolphin Store Warning] No initial state captured for store "${storeName}".`);
        }
    };

    clientProto._scanStoreBinds = function() {
        if (typeof document === 'undefined') return;

        this._initialStores = this._initialStores || new Map<string, any>();

        // 1. Declarative Store Initialization via <dolphin-store>
        const storeElements = document.querySelectorAll('dolphin-store');
        storeElements.forEach((el: any) => {
            if (typeof el.getAttribute !== 'function') return;
            const storeName = el.getAttribute('name') || el.getAttribute('data-store');
            if (!storeName) return;

            const hasChildren = el.children && el.children.length > 0;

            if (hasChildren) {
                if (typeof el.setAttribute === 'function') {
                    el.setAttribute('data-rt-bind', `store/${storeName}`);
                    el.setAttribute('data-rt-type', 'context');
                }
            } else {
                if (el.style) el.style.display = 'none';
            }

            let initialCaptured = false;

            // Option 0: Auto-hydrate from LocalStorage if data-persist="true"
            const shouldPersist = el.getAttribute('data-persist') === 'true';
            if (shouldPersist) {
                try {
                    const saved = localStorage.getItem(`dolphin_store_${storeName}`);
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        if (!this._initialStores.has(storeName)) {
                            this._initialStores.set(storeName, JSON.parse(JSON.stringify(parsed)));
                        }
                        this.setStoreState(storeName, parsed);
                        return;
                    }
                } catch {}
            }

            // Option A: Parse JSON text content (Objects & Array of Objects)
            if (!hasChildren) {
                const content = el.textContent ? el.textContent.trim() : '';
                if (content && (content.startsWith('{') || content.startsWith('['))) {
                    try {
                        const parsed = JSON.parse(content);
                        if (!this._initialStores.has(storeName)) {
                            this._initialStores.set(storeName, JSON.parse(JSON.stringify(parsed)));
                            initialCaptured = true;
                        }
                        this.setStoreState(storeName, parsed);
                    } catch (err: any) {
                        console.error(`[Dolphin Store Init Error] Failed to parse JSON inside <dolphin-store name="${storeName}">`);
                    }
                }
            }

            // Option B: Parse key-value attributes (Initial Values e.g. count="0" view="home")
            const templateSelector = el.getAttribute('template');
            if (el.attributes) {
                const excludeAttrs = ['name', 'data-store', 'style', 'data-rt-bind', 'data-rt-type', 'template', 'data-persist', 'data-api-get', 'data-api-poll'];
                Array.from(el.attributes).forEach((attr: any) => {
                    if (!excludeAttrs.includes(attr.name)) {
                        let val: any = attr.value;
                        if (val === 'true') val = true;
                        else if (val === 'false') val = false;
                        else if (val === 'null') val = null;
                        else if (!isNaN(Number(val)) && val.trim() !== '') val = Number(val);
                        this.setStoreState(storeName, attr.name, val);
                    }
                });
                if (!initialCaptured && !this._initialStores.has(storeName) && this.uiStores.get(storeName)) {
                    this._initialStores.set(storeName, JSON.parse(JSON.stringify(this.uiStores.get(storeName))));
                }
            }



            // Auto-wire template selector
            if (templateSelector && !hasChildren && el.parentNode && typeof document !== 'undefined') {
                const markerId = `_ds_${storeName}_${templateSelector.replace(/[^a-z0-9]/gi, '_')}`;
                let wrapper = document.querySelector(`[data-ds-wired="${markerId}"]`);
                if (!wrapper) {
                    wrapper = document.createElement('div');
                    wrapper.setAttribute('data-rt-bind', `store/${storeName}`);
                    wrapper.setAttribute('data-rt-template', templateSelector);
                    wrapper.setAttribute('data-ds-wired', markerId);
                    el.parentNode.insertBefore(wrapper, el.nextSibling);
                }
                if (typeof this._updateDOM === 'function') {
                    this.uiStores = this.uiStores || new Map();
                    const currentStore = this.uiStores.get(storeName) || {};
                    this._updateDOM(`store/${storeName}`, currentStore);
                }
            }

            if (hasChildren && typeof this._updateDOM === 'function') {
                this.uiStores = this.uiStores || new Map();
                const currentStore = this.uiStores.get(storeName) || {};
                this._updateDOM(`store/${storeName}`, currentStore);
            }
        });

        // 2. Wire up data-store-reset buttons
        const resetEls = document.querySelectorAll('[data-store-reset]');
        resetEls.forEach((el: any) => {
            if (el._resetWired) return;
            el._resetWired = true;
            const targetStore = el.getAttribute('data-store-reset');
            if (targetStore && typeof el.addEventListener === 'function') {
                el.addEventListener('click', () => {
                    this.resetStoreState(targetStore);
                });
            }
        });

        // 2. Scan data-store-write inputs
        const writeEls = document.querySelectorAll('[data-store-write]');
        writeEls.forEach((el: any) => {
            const writeBind = el.getAttribute('data-store-write');
            if (writeBind) {
                const parts = writeBind.split('.');
                if (parts.length === 2) {
                    const storeName = parts[0];
                    const key = parts[1];
                    const val = el.type === 'checkbox' ? el.checked : el.value;
                    this.uiStores = this.uiStores || new Map<string, Record<string, any>>();
                    if (!this.uiStores.has(storeName)) this.uiStores.set(storeName, {});
                    const store = this.uiStores.get(storeName);
                    if (store[key] === undefined) store[key] = val;
                }
            }
        });

        // 3. Sync data-store-read elements with current state
        const readEls = document.querySelectorAll('[data-store-read]');
        readEls.forEach((el: any) => {
            const readBind = el.getAttribute('data-store-read');
            if (readBind) {
                const parts = readBind.split('.');
                if (parts.length === 2) {
                    const storeName = parts[0];
                    const key = parts[1];
                    const val = this.getStoreState(storeName, key);
                    if (val !== undefined && val !== null) {
                        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                            if (el.type === 'checkbox') el.checked = !!val;
                            else el.value = val;
                        } else {
                            el.textContent = val;
                        }
                    }
                }
            }
        });
    };

    clientProto.getClosestContext = function(element: Element, key?: string) {
        let current: any = element;
        while (current) {
            if (current._rtContext) {
                const ctx = current._rtContext;
                if (key) return ctx[key];
                return ctx;
            }
            current = current.parentElement || current.parentNode;
        }
        return null;
    };

    clientProto._executeStoreAction = function(expression: string, element?: Element) {
        this.uiStores = this.uiStores || new Map<string, Record<string, any>>();
        const parentCtx = (element && typeof this.getClosestContext === 'function') ? this.getClosestContext(element) : null;

        // Resolve closest store name for shorthand expressions like `count = count + 1`
        const getClosestStoreName = (el?: Element): string | null => {
            if (!el) return null;
            let cursor: Element | null = el;
            while (cursor) {
                const bind = cursor.getAttribute && cursor.getAttribute('data-rt-bind');
                if (bind && bind.startsWith('store/')) return bind.slice(6);
                const dsName = cursor.getAttribute && (cursor.getAttribute('name') || cursor.getAttribute('data-store'));
                if (dsName && cursor.tagName && cursor.tagName.toLowerCase() === 'dolphin-store') return dsName;
                cursor = cursor.parentElement;
            }
            return null;
        };
        const closestStoreName = getClosestStoreName(element);

        const context = new Proxy({}, {
            has: (_target, _prop) => true,
            set: (_target, prop, val) => {
                if (typeof prop === 'string') {
                    // Handle nested path assignment (e.g., nested.level1.level2.value = '...')
                    if (prop.includes('.')) {
                        const parts = prop.split('.');
                        const rootProp = parts[0];
                        const nestedPath = parts.slice(1).join('.');
                        
                        if (closestStoreName) {
                            const store = this.uiStores.get(closestStoreName);
                            if (store && rootProp in store) {
                                // Navigate to the nested location and set value
                                let current = store[rootProp];
                                for (let i = 0; i < parts.length - 1; i++) {
                                    const part = parts[i];
                                    if (current === undefined || current === null) {
                                        // Create missing intermediate objects
                                        current = {};
                                        if (i === 0) {
                                            store[rootProp] = current;
                                        } else {
                                            // This is a simplification - full nested path creation would be more complex
                                            console.warn('[Dolphin Store Action] Cannot create nested path:', prop);
                                            return false;
                                        }
                                    }
                                    current = current[part];
                                }
                                // Set the final value
                                const lastPart = parts[parts.length - 1];
                                current[lastPart] = val;
                                this.publish(`store/${closestStoreName}`, store);
                                return true;
                            }
                        }
                    }
                    
                    if (closestStoreName && parentCtx && prop in parentCtx) {
                        this.setStoreState(closestStoreName, prop, val);
                        return true;
                    }
                    if (this.uiStores) {
                        for (const [sName, sState] of this.uiStores) {
                            if (prop in sState) {
                                this.setStoreState(sName, prop, val);
                                return true;
                            }
                        }
                    }
                    if (closestStoreName) {
                        this.setStoreState(closestStoreName, prop, val);
                        return true;
                    }
                }
                return false;
            },
            get: (_target, prop) => {
                if (typeof prop === 'string') {
                    if (prop === 'log') {
                        return (arg: any) => {
                            if (arg === undefined) {
                                const allStores: Record<string, any> = {};
                                this.uiStores.forEach((val: any, key: string) => { allStores[key] = { ...val }; });
                                console.log(`%c📊 [Dolphin All UI Stores]:`, 'color: #06b6d4; font-weight: bold;', allStores);
                            } else if (arg && typeof arg === 'object' && arg.__isStoreProxy__) {
                                const sn = arg.__storeName__;
                                console.log(`%c📊 [Dolphin Store: ${sn}]:`, 'color: #06b6d4; font-weight: bold;', this.uiStores.get(sn) ? { ...this.uiStores.get(sn) } : {});
                            } else {
                                console.log(`%c📊 [Dolphin Log]:`, 'color: #06b6d4; font-weight: bold;', arg);
                            }
                        };
                    }
                    // DolphinStore (DB) collection access
                    if (this.store && this.store.data && typeof this.store.data.has === 'function' && this.store.data.has(prop)) {
                        const collection = this.store.data.get(prop);
                        const self = this;
                        const collectionName = prop;
                        const RENDER_METHODS = new Set(['search','filter','range','sort','clearFilters','where','orderBy','reset','add','updateById','deleteById','optimisticDelete','optimisticUpdate','trackStart','trackEnd']);
                        return new Proxy(collection, {
                            get(target: any, method: string) {
                                if (typeof target[method] === 'function') {
                                    return (...args: any[]) => {
                                        const result = target[method](...args);
                                        if (RENDER_METHODS.has(method) && typeof self._updateDOM === 'function') {
                                            const triggerRender = () => { if (typeof self._updateDOM === 'function') self._updateDOM(`store/${collectionName}`, collection); };
                                            if (result && typeof result.then === 'function') result.then(triggerRender).catch(triggerRender);
                                            else triggerRender();
                                        }
                                        return result;
                                    };
                                }
                                return target[method];
                            }
                        });
                    }
                    if (parentCtx && parentCtx[prop] !== undefined) return parentCtx[prop];
                    if (typeof globalThis !== 'undefined' && prop in globalThis) return (globalThis as any)[prop];
                    if (typeof window !== 'undefined' && prop in window) return (window as any)[prop];
                    return new Proxy({}, {
                        get: (_sub, subProp) => {
                            if (subProp === '__storeName__') return prop;
                            if (subProp === '__isStoreProxy__') return true;
                            if (typeof subProp === 'string') return this.getStoreState(prop, subProp);
                        },
                        set: (_sub, subProp, val) => {
                            if (typeof subProp === 'string') { this.setStoreState(prop, subProp, val); return true; }
                            return false;
                        }
                    });
                }
            }
        });

        try {
            const fn = new Function('ctx', `with(ctx) { ${expression} }`);
            fn.call(element, context);
        } catch (err) {
            console.error('%c[Dolphin Store Action Error]:', 'color: #ef4444; font-weight: bold;', err);
            if (element) console.error('%cFailed Element:', 'color: #f97316; font-weight: bold;', element);
            console.error('%cFailed Expression:', 'color: #3b82f6; font-style: italic;', expression);
        }
    };
}
