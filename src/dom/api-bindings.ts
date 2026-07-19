/**
 * dom/api-bindings.ts — REST API DOM bindings.
 * Handles: data-api-get (auto-fetch), data-api-submit (form submit),
 * data-api-{event} (click/change etc.), data-api-result, data-api-redirect.
 */

import { sanitizeHTML, resolveTemplate, escapeRegExp } from './helpers';
import { renderTemplate } from './template';
import { scheduleDOMUpdate } from './helpers';

export function attachAPIBindings(clientProto: any) {

    clientProto._scanAndFetchAPIBinds = async function() {
        if (typeof document === 'undefined') return;
        const elements = document.querySelectorAll('[data-api-get]');
        for (const el of Array.from(elements)) {
            const path = el.getAttribute('data-api-get');
            if (!path) continue;
            // @fix: Skip already-initialized elements to prevent duplicate fetches on SPA navigation
            if (typeof (el as any).hasAttribute === 'function' && el.hasAttribute('data-api-initialized')) continue;
            if (typeof (el as any).setAttribute === 'function') {
                el.setAttribute('data-api-initialized', 'true');
            }
            try {
                if (this.options?.debug) {
                    console.log(`%c🐬 [Dolphin API Debug]: Fetching GET ${path}...`, 'color: #3b82f6; font-weight: bold;');
                }
                const result = await this.api.get(path);
                if (this.options?.debug) {
                    const count = Array.isArray(result) ? `${result.length} items` : typeof result;
                    console.log(`%c🐬 [Dolphin API Debug]: Received ${count} from ${path}`, 'color: #10b981; font-weight: bold;', result);
                }

                const storeName = el.getAttribute('name') || el.getAttribute('data-store');
                if (storeName) {
                    this.setStoreState(storeName, result);

                    // Background Polling Support (e.g. data-api-poll="5000")
                    const pollInterval = Number(el.getAttribute('data-api-poll'));
                    if (!isNaN(pollInterval) && pollInterval > 0 && !(el as any)._pollTimerWired) {
                        (el as any)._pollTimerWired = true;
                        setInterval(async () => {
                            try {
                                const freshData = await this.api.get(path);
                                this.setStoreState(storeName, freshData);
                            } catch {}
                        }, pollInterval);
                    }

                    continue;
                }

                const apiStore = el.getAttribute('data-api-store');
                if (apiStore) {
                    const parts = apiStore.split('.');
                    if (parts.length === 2) {
                        if (Array.isArray(result)) {
                            this.setStoreState(parts[0], parts[1], result);
                        } else {
                            console.warn(`[Dolphin API Binding Warning] Expected array for "${apiStore}" but received:`, result);
                        }
                    }
                }

                const rtBind = el.getAttribute('data-rt-bind');

                if (rtBind && !apiStore) {
                    this._updateDOM(rtBind, result);
                } else if (!apiStore) {
                    const template = resolveTemplate(el);
                    if (template && typeof result === 'object' && result !== null) {
                        const processedResult = this._applyDeclarativeDirectives(el, result);
                        if (Array.isArray(processedResult)) {
                            let combinedHTML = '';
                            for (const item of processedResult) combinedHTML += renderTemplate(template, item);
                            scheduleDOMUpdate(el, combinedHTML);
                        } else {
                            scheduleDOMUpdate(el, renderTemplate(template, processedResult));
                        }
                    } else {
                        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                            (el as any).value = typeof result === 'object' ? (result.value !== undefined ? result.value : '') : result;
                        } else {
                            // @fix: Sanitize only non-template direct HTML
                            const rawHTML = typeof result === 'object' ? (result.html || result.text || JSON.stringify(result)) : String(result);
                            el.innerHTML = sanitizeHTML(rawHTML);
                        }
                    }
                }
            } catch(e) {
                if (this.options?.debug) console.error('[Dolphin] API Get Error:', e);
            }
        }
    };
}
