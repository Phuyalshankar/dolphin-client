/**
 * dom/index.ts — Assembly point for all DOM sub-modules.
 * Replaces the monolithic dom.ts by composing focused sub-modules.
 *
 * Sub-modules:
 *  - helpers.ts       — shared utilities (sanitizeHTML, diffDOM, RAF scheduler, etc.)
 *  - template.ts      — Svelte-style template compiler
 *  - store-bindings.ts — setStoreState, getStoreState, _scanStoreBinds, _executeStoreAction
 *  - rt-bindings.ts   — _updateDOM, _applyDeclarativeDirectives
 *  - api-bindings.ts  — _scanAndFetchAPIBinds
 *  - imports.ts       — _resolveImports (data-import component loader)
 *  - router.ts        — _initSPARouter (hash + history mode SPA router)
 */

import { scanVFSBinds } from '../vfs';
import { attachStoreBindings } from './store-bindings';
import { attachRTBindings } from './rt-bindings';
import { attachAPIBindings } from './api-bindings';
import { attachImports } from './imports';
import { attachRouter } from './router';
import { escapeRegExp } from './helpers';

// Re-export utilities for consumers
export { sanitizeHTML, evaluateExpression } from './helpers';
export { renderTemplate, renderTemplate as compileTemplate } from './template';

/**
 * Attach all DOM binding methods to DolphinClient.prototype.
 * Called once during client initialization.
 */
export function attachDOMBinding(clientProto: any) {

    // ── VFS Scanner bridge ────────────────────────────────────────────────────
    clientProto._scanVFSBinds = function() {
        scanVFSBinds(this);
    };

    // ── Shared component promise cache (used by _resolveImports) ─────────────
    // @fix: Failed promises are evicted from cache so retries fetch fresh content
    const componentPromiseCache = new Map<string, Promise<string>>();

    // ── Attach sub-modules ────────────────────────────────────────────────────
    attachStoreBindings(clientProto);
    attachRTBindings(clientProto);
    attachAPIBindings(clientProto);
    attachImports(clientProto, componentPromiseCache);
    attachRouter(clientProto);

    // ── _initDOMBinding — Main entry: wire all DOM event listeners ────────────
    clientProto._initDOMBinding = function() {
        if (typeof window !== 'undefined') {
            const win = window as any;
            if (win.__dolphin_active_client && win.__dolphin_active_client !== this) {
                try {
                    win.__dolphin_active_client.cleanupDomListeners();
                    win.__dolphin_active_client._domInitialized = false;
                } catch (e) {
                    console.warn('[Dolphin] Failed to clean up old client DOM listeners:', e);
                }
            }
            win.__dolphin_active_client = this;
        }

        if (this._domInitialized) return;
        this._domInitialized = true;

        // 1. Listen for inputs and value changes with dynamic debouncing
        const PUSH_EVENTS = ['input', 'change', 'keyup', 'paste', 'blur'];
        // @fix: WeakMap allows GC of removed elements automatically
        const debounceTimers = new WeakMap<Element, any>();

        PUSH_EVENTS.forEach(evtName => {
            this.addDomListener(document, evtName, (e: any) => {
                if (!e.target || !e.target.getAttribute) return;

                // data-store-write reactive store bindings
                const writeBind = e.target.getAttribute('data-store-write');
                if (writeBind) {
                    const parts = writeBind.split('.');
                    if (parts.length === 2) {
                        const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                        this.setStoreState(parts[0], parts[1], val, e.target);
                    }
                }

                // data-rt-validate dynamic validation
                const rules = e.target.getAttribute('data-rt-validate');
                const name = e.target.name;
                if (rules && name && typeof this.validateField === 'function') {
                    const form = e.target.closest('form');
                    const formValues = form ? Object.fromEntries(new (FormData as any)(form).entries()) : {};
                    const errorMsg = this.validateField(e.target.value, rules, formValues as any);
                    if (errorMsg) {
                        e.target.classList.add('invalid');
                        this.publish(`errors/${name}`, errorMsg);
                    } else {
                        e.target.classList.remove('invalid');
                        this.publish(`errors/${name}`, '');
                    }
                }

                // data-rt-push topic updates
                const topic = e.target.getAttribute('data-rt-push');
                if (topic) {
                    const debounceVal = e.target.getAttribute('data-rt-debounce');
                    const waitMs = debounceVal ? parseInt(debounceVal, 10) : 0;
                    const triggerPush = () => {
                        const payload = { name: e.target.name, value: e.target.value, deviceId: this.deviceId };
                        this.pubPush(topic, payload);
                    };
                    if (waitMs > 0) {
                        if (debounceTimers.has(e.target)) clearTimeout(debounceTimers.get(e.target));
                        debounceTimers.set(e.target, setTimeout(triggerPush, waitMs));
                    } else {
                        triggerPush();
                    }
                }
            });
        });

        // 2. Form submits (RT + API)
        this.addDomListener(document, 'submit', async (e: any) => {
            if (!e.target || !e.target.getAttribute) return;

            const rtTopic = e.target.getAttribute('data-rt-submit');
            const apiTarget = e.target.getAttribute('data-api-submit');

            if (rtTopic || apiTarget) {
                // Clear old validation errors
                const formInputs = e.target.querySelectorAll('[name]');
                formInputs.forEach((inputEl: any) => {
                    if (inputEl.name) { this.publish(`errors/${inputEl.name}`, ''); inputEl.classList.remove('invalid'); }
                });

                // Validate form inputs
                const validatedInputs = e.target.querySelectorAll('[data-rt-validate]');
                let formIsValid = true;
                if (validatedInputs.length > 0 && typeof this.validateField === 'function') {
                    const formValues = Object.fromEntries(new (FormData as any)(e.target).entries());
                    validatedInputs.forEach((inputEl: any) => {
                        const rules = inputEl.getAttribute('data-rt-validate');
                        const name = inputEl.name;
                        if (rules && name) {
                            const errorMsg = this.validateField(inputEl.value, rules, formValues as any);
                            if (errorMsg) { formIsValid = false; inputEl.classList.add('invalid'); this.publish(`errors/${name}`, errorMsg); }
                        }
                    });
                }
                if (!formIsValid) { e.preventDefault(); e.stopPropagation(); return; }

                e.preventDefault();
                const parentCtx = this.getClosestContext(e.target) || {};
                const data = Object.fromEntries(new (FormData as any)(e.target).entries());

                if (rtTopic) {
                    let resolvedTopic = rtTopic;
                    for (const k in parentCtx) {
                        const escapedK = escapeRegExp(k);
                        resolvedTopic = resolvedTopic.replace(new RegExp(`\\{\\{${escapedK}\\}\\}`, 'g'), parentCtx[k] ?? '');
                    }
                    this.publish(resolvedTopic, data);
                } else if (apiTarget) {
                    let resolvedTarget = apiTarget;
                    for (const k in parentCtx) {
                        const escapedK = escapeRegExp(k);
                        resolvedTarget = resolvedTarget.replace(new RegExp(`\\{\\{${escapedK}\\}\\}`, 'g'), parentCtx[k] ?? '');
                    }
                    const parts = resolvedTarget.trim().split(' ');
                    let method = parts.length > 1 ? parts[0].toUpperCase() : 'POST';
                    const path = parts.length > 1 ? parts[1] : parts[0];
                    if ((data as any)._method) method = String((data as any)._method).toUpperCase();
                    try {
                        const result = await this.api.request(method, path, data);
                        const resultBind = e.target.getAttribute('data-api-result');
                        if (resultBind) this._updateDOM(resultBind, result);
                        const redirect = e.target.getAttribute('data-api-redirect');
                        if (redirect) window.location.href = redirect;
                        if (e.target.hasAttribute('data-api-reload')) window.location.reload();
                    } catch (err) {
                        console.error('[Dolphin] API Submit Error:', err);
                    }
                }
            }
        });

        // 3. Unified interaction event listeners (click, change, keydown, etc.)
        const INTERACTION_EVENTS = ['click','change','input','keydown','keyup','dblclick','focus','blur','mouseenter','mouseleave'];
        INTERACTION_EVENTS.forEach(evtName => {
            this.addDomListener(document, evtName, async (e: any) => {
                if (!e.target || !e.target.closest) return;

                const rtBtn = e.target.closest(`[data-rt-${evtName}]`);
                const apiBtn = e.target.closest(`[data-api-${evtName}]`);

                if (rtBtn) {
                    if (evtName === 'submit') e.preventDefault();
                    const topic = rtBtn.getAttribute(`data-rt-${evtName}`);
                    const actionData = rtBtn.getAttribute('data-rt-payload');
                    const parentCtx = this.getClosestContext(rtBtn) || {};
                    let payload = {};
                    if (actionData) {
                        let resolvedDataStr = actionData;
                        for (const k in parentCtx) {
                            const escapedK = escapeRegExp(k);
                            resolvedDataStr = resolvedDataStr.replace(new RegExp(`\\{\\{${escapedK}\\}\\}`, 'g'), parentCtx[k] ?? '');
                        }
                        try { payload = JSON.parse(resolvedDataStr); } catch { payload = {}; }
                    }
                    this.publish(topic, payload);
                }

                if (apiBtn) {
                    if (evtName === 'submit') e.preventDefault();
                    const apiTarget = apiBtn.getAttribute(`data-api-${evtName}`);
                    const actionData = apiBtn.getAttribute('data-api-payload');
                    const parentCtx = this.getClosestContext(apiBtn) || {};
                    const parts = apiTarget.trim().split(' ');
                    const method = parts.length > 1 ? parts[0].toUpperCase() : 'POST';
                    const path = parts.length > 1 ? parts[1] : parts[0];
                    let p2payload = null;
                    if (actionData) {
                        let resolvedDataStr = actionData;
                        for (const k in parentCtx) {
                            const escapedK = escapeRegExp(k);
                            resolvedDataStr = resolvedDataStr.replace(new RegExp(`\\{\\{${escapedK}\\}\\}`, 'g'), parentCtx[k] ?? '');
                        }
                        try { p2payload = JSON.parse(resolvedDataStr); } catch { p2payload = null; }
                    }
                    try {
                        const result = await this.api.request(method, path, p2payload);
                        const resultBind = apiBtn.getAttribute('data-api-result');
                        if (resultBind) this._updateDOM(resultBind, result);
                        const redirect = apiBtn.getAttribute('data-api-redirect');
                        if (redirect) window.location.href = redirect;
                        if (apiBtn.hasAttribute('data-api-reload')) window.location.reload();
                    } catch (err) {
                        console.error(`[Dolphin] API ${evtName} Error:`, err);
                    }
                }

                const storeActionBtn = e.target.closest(`[data-store-${evtName}]`);
                if (storeActionBtn) {
                    if (evtName === 'submit') e.preventDefault();
                    const expr = storeActionBtn.getAttribute(`data-store-${evtName}`);
                    if (expr) this._executeStoreAction(expr, storeActionBtn);
                }
            });
        });

        // 4. Subscribe to all RT topics — auto-update DOM bindings
        this.subscribe('#', (payload: any, topic: string) => {
            this._updateDOM(topic, payload);
        });

        // 4b. Subscribe to error topics — sync to the errors store state
        this.subscribe('errors/#', (payload: any, topic: string) => {
            const field = topic.split('/').slice(1).join('/');
            if (field && typeof this.setStoreState === 'function') {
                this.setStoreState('errors', field, payload);
            }
        });

        // 5–8. Bootstrap scans
        this._scanAndFetchAPIBinds();
        this._scanStoreBinds();
        this._scanVFSBinds();
        this._resolveImports();
        this._initSPARouter();
    };
}
