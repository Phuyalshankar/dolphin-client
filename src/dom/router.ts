/** dom/router.ts — Instant SPA Router. Supports hash and history pushState modes. */

import { executeScripts } from './helpers';

export function attachRouter(clientProto: any) {
    clientProto._initSPARouter = function() {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        if (this._routerInitialized) return;
        this._routerInitialized = true;
        // @fix: Track in-flight navigation fetch so it can be aborted on new navigation (was: race condition)
        let _spaAbortController: AbortController | null = null;

        const routerMode: string = this.options.routerMode || 'hash';

        const findViewport = () => {
            const selector = this.options.routerViewport || 'main, #viewport, body';
            const selectors = selector.split(',').map((s: string) => s.trim());
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el) return el;
            }
            return document.body;
        };

        const applyPage = async (html: string, pushUrlOrHash?: string, pushState = true) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            if (doc.title) document.title = doc.title;

            const newViewport = doc.querySelector(this.options.routerViewport || 'main, #viewport, body');
            const currentViewport = findViewport();

            if (newViewport && currentViewport) {
                currentViewport.innerHTML = newViewport.innerHTML;
                Array.from(newViewport.attributes).forEach((attr: any) => {
                    currentViewport.setAttribute(attr.name, attr.value);
                });
            } else if (currentViewport) {
                currentViewport.innerHTML = doc.body.innerHTML;
            }

            if (pushState && pushUrlOrHash) {
                if (routerMode === 'hash') {
                    // Update hash without triggering another hashchange
                    const newHash = pushUrlOrHash.startsWith('#') ? pushUrlOrHash : '#' + pushUrlOrHash;
                    if (window.location.hash !== newHash) {
                        window.history.pushState({ dolphinSpa: true, hash: newHash }, '', newHash);
                    }
                } else {
                    window.history.pushState({ dolphinSpa: true, url: pushUrlOrHash }, '', pushUrlOrHash);
                }
            }

            if (this.options.routerTransitions && currentViewport) {
                currentViewport.classList.remove('dolphin-fade-out');
                currentViewport.classList.add('dolphin-fade-in');
                setTimeout(() => currentViewport.classList.remove('dolphin-fade-in'), 300);
            }

            await this._resolveImports(currentViewport);
            executeScripts(currentViewport);

            // Clear all fields in the errors store on page navigation to prevent stale errors displaying on new forms
            if (this.uiStores && this.uiStores.has('errors')) {
                const errStore = this.uiStores.get('errors');
                if (errStore) {
                    for (const key in errStore) {
                        this.setStoreState('errors', key, null);
                    }
                }
            }

            // Scan for <dolphin-store> tags in the entire document (not just viewport)
            // This ensures global stores from store.html are always available
            const allStoreElements = document.querySelectorAll('dolphin-store');
            if (allStoreElements.length > 0) {
                this.uiStores = this.uiStores || new Map();
                allStoreElements.forEach((el: any) => {
                    const storeName = el.getAttribute('name') || el.getAttribute('data-store');
                    if (!storeName) return;
                    if (!this.uiStores.has(storeName)) {
                        this.uiStores.set(storeName, {});
                    }
                    const store = this.uiStores.get(storeName);
                    // Parse attributes as store values (only if not already set)
                    if (el.attributes) {
                        const excludeAttrs = ['name', 'data-store', 'style', 'data-rt-bind', 'data-rt-type', 'template'];
                        Array.from(el.attributes).forEach((attr: any) => {
                            if (!excludeAttrs.includes(attr.name)) {
                                // Only set if not already in store (preserve existing data)
                                if (store[attr.name] === undefined) {
                                    let val: any = attr.value;
                                    if (val === 'true') val = true;
                                    else if (val === 'false') val = false;
                                    else if (val === 'null') val = null;
                                    else if (!isNaN(Number(val)) && val.trim() !== '') val = Number(val);
                                    store[attr.name] = val;
                                }
                            }
                        });
                    }
                    // Set up reactivity if element has children
                    if (el.children && el.children.length > 0) {
                        el.setAttribute('data-rt-bind', `store/${storeName}`);
                        el.setAttribute('data-rt-type', 'context');
                    }
                    // Publish store data to trigger reactivity
                    this.publish(`store/${storeName}`, store);
                });
                // Trigger DOM update for all stores
                this.uiStores.forEach((store: any, storeName: string) => {
                    this._updateDOM(`store/${storeName}`, store);
                });
            }

            this._scanStoreBinds();
            this._scanAndFetchAPIBinds();
            this._scanVFSBinds();
        };

        const loadPage = async (rawUrl: string, pushState = true) => {
            try {
                if (this.options.debug) {
                    console.log(`%c🛣️ [Dolphin Router]: Navigating to ${rawUrl}...`, 'color: #3b82f6; font-weight: bold;');
                }

                // @fix: Abort any in-flight navigation to prevent race conditions (was: older fetch could overwrite newer)
                if (_spaAbortController) _spaAbortController.abort();
                _spaAbortController = new AbortController();
                const signal = _spaAbortController.signal;

                // @fix: Always resolve fetch URL against document.baseURI (respects <base href="/">)
                // so that fetch('/register') always hits the correct origin on CDN (was: resolved relative to current path)
                const baseURI = document.baseURI || window.location.origin + '/';
                const absoluteUrl = new URL(rawUrl, baseURI).href;

                const viewport = findViewport();
                if (this.options.routerTransitions && viewport) {
                    viewport.classList.add('dolphin-fade-out');
                    await new Promise(r => setTimeout(r, 150));
                }

                const response = await fetch(absoluteUrl, { signal });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const html = await response.text();
                _spaAbortController = null;

                await applyPage(html, rawUrl, pushState);

            } catch (err: any) {
                // @fix: Don't redirect on AbortError — it's an intentional cancellation, not a real error
                if (err && err.name === 'AbortError') return;
                console.error('[Dolphin Router Error]: Failed to route page:', err);
                window.location.href = rawUrl;
            }
        };

        // ── HASH ROUTING MODE ─────────────────────────────────────────────────
        // @fix: Hash routing (#/register) is the default CDN-safe mode.
        // The hash portion is NEVER sent to the server, so the server always
        // serves index.html and the client handles routing entirely in-browser.
        // No _redirects, vercel.json, or 404.html required.
        if (routerMode === 'hash') {
            const getHashPath = (): string => {
                const hash = window.location.hash;
                if (!hash || hash === '#' || hash === '#/') return '';
                // Strip the leading '#', give back e.g. '/register' or '/dashboard/profile'
                return hash.slice(1);
            };

            const loadHashPage = async (path: string) => {
                if (!path || path === '/') return; // root — nothing to load
                if (this.options.debug) {
                    console.log(`%c🛣️ [Dolphin Hash Router]: Loading ${path}`, 'color: #3b82f6; font-weight: bold;');
                }

                // Try candidates: /register.html → /register/index.html → /register (in that order)
                const bare = path.endsWith('/') ? path.slice(0, -1) : path;
                const candidates: string[] = [];
                if (!bare.endsWith('.html')) {
                    candidates.push(bare + '.html');
                    candidates.push(bare + '/index.html');
                }
                candidates.push(bare);

                if (_spaAbortController) _spaAbortController.abort();
                _spaAbortController = new AbortController();
                const signal = _spaAbortController.signal;

                const baseURI = document.baseURI || window.location.origin + '/';
                let html: string | null = null;

                for (const candidate of candidates) {
                    try {
                        const absoluteUrl = new URL(candidate, baseURI).href;
                        const res = await fetch(absoluteUrl, { signal });
                        if (res.ok) {
                            html = await res.text();
                            break;
                        }
                    } catch (err: any) {
                        if (err && err.name === 'AbortError') return;
                    }
                }

                _spaAbortController = null;

                if (html !== null) {
                    const viewport = findViewport();
                    if (this.options.routerTransitions && viewport) {
                        viewport.classList.add('dolphin-fade-out');
                        await new Promise(r => setTimeout(r, 150));
                    }
                    // pushState=false: hash is already in the URL, don't double-push
                    await applyPage(html, undefined, false);
                } else {
                    console.warn(`[Dolphin Hash Router]: No page found for hash path "${path}"`);
                }
            };

            // Load page matching the current hash on first init
            const initialPath = getHashPath();
            if (initialPath) {
                loadHashPage(initialPath);
            }

            // Listen for hash changes (back/forward + programmatic hash updates)
            this.addDomListener(window, 'hashchange', () => {
                loadHashPage(getHashPath());
            });

            // Intercept <a data-spa> clicks → convert to hash navigation (no full reload)
            this.addDomListener(document, 'click', (e: any) => {
                const anchor = e.target.closest('a');
                if (!anchor) return;
                if (!anchor.hasAttribute('data-spa')) return;

                const href = anchor.getAttribute('href');
                if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

                // Already a hash link — let browser handle it (hashchange fires automatically)
                if (href.startsWith('#')) return;

                // External link — don't intercept
                try {
                    const parsed = new URL(href, window.location.href);
                    if (parsed.origin !== window.location.origin) return;
                } catch { return; }

                e.preventDefault();
                // Convert to hash navigation: /register → #/register
                const hashTarget = href.startsWith('/') ? '#' + href : '#/' + href;
                window.location.hash = hashTarget;
            });

        // ── HISTORY (pushState) MODE ──────────────────────────────────────────
        // Clean URLs (/register) but requires server/CDN to serve index.html for all routes.
        } else {
            this.addDomListener(document, 'click', (e: any) => {
                const anchor = e.target.closest('a');
                if (!anchor) return;
                if (!anchor.hasAttribute('data-spa')) return;

                const href = anchor.getAttribute('href');
                if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

                const url = new URL(href, window.location.href);
                if (url.origin !== window.location.origin) return;

                e.preventDefault();
                loadPage(href);
            });

            this.addDomListener(window, 'popstate', (e: any) => {
                if (e.state && e.state.dolphinSpa) {
                    loadPage(e.state.url, false);
                } else if (e.state === null) {
                    loadPage(window.location.pathname, false);
                }
            });
        }

        if (this.options.routerTransitions) {
            const style = document.createElement('style');
            style.innerHTML = `
                .dolphin-fade-out {
                    opacity: 0;
                    transition: opacity 0.15s ease-in-out;
                }
                .dolphin-fade-in {
                    opacity: 0;
                }
                main, #viewport, body {
                    transition: opacity 0.15s ease-in-out;
                }
            `;
            document.head.appendChild(style);
        }
    };
}
