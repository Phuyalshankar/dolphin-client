/** dom/imports.ts — HTML Component Import engine (data-import). Supports nested imports, concurrent caching, circular dependency detection. */

import { sanitizeHTML, executeScripts } from './helpers';
import { preprocessJSX } from './template';

export function attachImports(clientProto: any, componentPromiseCache: Map<string, Promise<string>>) {
    clientProto._resolveImports = async function(container?: Element) {
        if (typeof document === 'undefined') return;
        const root = container || document.body || document;
        if (!root || typeof root.querySelectorAll !== 'function') return;
        const elements = root.querySelectorAll('[data-import]');
        if (elements.length === 0) return;

        const resolveNode = async (el: Element, resolvingSet: Set<string>) => {
            const src = el.getAttribute('data-import');
            if (!src) return;

            if (resolvingSet.has(src)) {
                console.warn(`[Dolphin Component Warning]: Circular import detected for "${src}". Skipping resolving.`);
                el.innerHTML = `<span style="color:red;font-weight:bold;">Circular import: ${src}</span>`;
                return;
            }

            resolvingSet.add(src);

            const hashIndex = src.indexOf('#');
            const rawUrl = hashIndex !== -1 ? src.substring(0, hashIndex) : src;
            const selector = hashIndex !== -1 ? src.substring(hashIndex) : null;

            const baseURI = typeof window !== 'undefined' ? window.location.href : '/';
            const url = rawUrl
                ? new URL(rawUrl, baseURI).href
                : baseURI;

            let promise = componentPromiseCache.get(url);
            if (!promise) {
                promise = fetch(url).then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.text();
                });
                // @fix: Evict failed promises from cache so retries work (was: cached error forever)
                promise.catch(() => componentPromiseCache.delete(url));
                componentPromiseCache.set(url, promise);
            }

            let content = '';
            try {
                content = await promise;
                if (selector && typeof DOMParser !== 'undefined') {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(content, 'text/html');
                    const targetEl = doc.querySelector(selector);
                    if (targetEl) {
                        content = targetEl.outerHTML;
                    } else {
                        console.warn(`[Dolphin Component Warning]: Selector "${selector}" not found in imported file "${url}".`);
                        content = `<span style="color:orange;font-weight:bold;">Selector ${selector} not found in ${url}</span>`;
                    }
                }
            } catch (err) {
                console.error(`[Dolphin Component Error]: Failed to fetch component "${url}":`, err);
                content = `<span style="color:red;font-weight:bold;">Failed to import ${url}</span>`;
            }

            // Component HTML is template/source file (no XSS risk like user payloads),
            // assign directly and run script tags
            el.innerHTML = preprocessJSX(content);
            executeScripts(el);
            el.removeAttribute('data-import');

            const nestedElements = el.querySelectorAll('[data-import]');
            if (nestedElements.length > 0) {
                const subPromises = Array.from(nestedElements).map(child => resolveNode(child, new Set(resolvingSet)));
                await Promise.all(subPromises);
            }

            this._scanStoreBinds();
            this._scanAndFetchAPIBinds();
            this._scanAndLoadModuleBinds();
        };

        const promises = Array.from(elements).map(el => resolveNode(el, new Set<string>()));
        await Promise.all(promises);

        if (this.uiStores) {
            this.uiStores.forEach((store: any, storeName: string) => {
                this._updateDOM(`store/${storeName}`, store);
            });
        }
    };
}
