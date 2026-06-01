export function attachDOMBinding(clientProto: any) {

    // Helper to escape special characters for regex search
    function escapeRegExp(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Helper to resolve template as either a raw HTML string or a CSS selector pointing to a <template> node
    function resolveTemplate(el: Element): string | null {
        const template = el.getAttribute('data-rt-template');
        if (!template) return null;
        if (typeof document !== 'undefined' && !template.includes('<')) {
            try {
                const tempEl = document.querySelector(template);
                if (tempEl) return tempEl.innerHTML;
            } catch {}
        }
        return template;
    }

    // Helper to compile and render Svelte-like block conditionals ({#if}, {:else if}, {:else}) and dynamic mustaches
    function renderTemplate(templateStr: string, context: any): string {
        // Fallback / Fast-path: If there are no Svelte-like block conditionals or loop blocks, do simple mustache replacement.
        // This is safe against keys with special characters (like user-id++).
        if (!templateStr.includes('{#if') && !templateStr.includes('{#each')) {
            let result = templateStr;
            for (let key in context) {
                const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                result = result.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g'), context[key] !== undefined && context[key] !== null ? context[key] : '');
            }
            return result;
        }

        try {
            // Helper to escape plain text so it is safe to be put in a double-quoted JS string
            const escapeString = (str: string): string => {
                return str
                    .replace(/\\/g, '\\\\')
                    .replace(/"/g, '\\"')
                    .replace(/\n/g, '\\n')
                    .replace(/\r/g, '\\r')
                    .replace(/\t/g, '\\t');
            };

            // Compile template using a highly robust tokenized approach
            // This prevents literal backticks (`) and "${" in original templates from breaking syntax.
            let compiled = 'let out = "";\n';
            let lastIndex = 0;
            const regex = /(\{\{([\s\S]*?)\}\}|\{#if\s+([\s\S]*?)\}|\{:else\s+if\s+([\s\S]*?)\}|\{:else\}|\{\/if\}|\{#each\s+([\s\S]*?)\s+as\s+([a-zA-Z_$][a-zA-Z0-9_$]*)(?:\s*,\s*([a-zA-Z_$][a-zA-Z0-9_$]*))?\}|\{\/each\}|\{([^{}]+?)\})/g;
            const eachStack: { indexVar?: string }[] = [];

            let match;
            while ((match = regex.exec(templateStr)) !== null) {
                const plainText = templateStr.slice(lastIndex, match.index);
                if (plainText) {
                    compiled += `out += "${escapeString(plainText)}";\n`;
                }

                const token = match[0];
                if (token.startsWith('{{')) {
                    const expr = match[2];
                    compiled += `out += (${expr} !== undefined && ${expr} !== null ? ${expr} : "");\n`;
                } else if (token.startsWith('{#if')) {
                    const expr = match[3];
                    compiled += `if (${expr}) {\n`;
                } else if (token.startsWith('{:else if')) {
                    const expr = match[4];
                    compiled += `} else if (${expr}) {\n`;
                } else if (token.startsWith('{:else}')) {
                    compiled += `} else {\n`;
                } else if (token.startsWith('{/if}')) {
                    compiled += `}\n`;
                } else if (token.startsWith('{#each')) {
                    const expr = match[5];
                    const itemVar = match[6];
                    const indexVar = match[7];
                    eachStack.push({ indexVar });
                    compiled += `if (typeof ${expr} !== "undefined" && ${expr} !== null && Array.isArray(${expr})) {\n`;
                    if (indexVar) {
                        compiled += `  let ${indexVar} = 0;\n`;
                    }
                    compiled += `  for (let ${itemVar} of ${expr}) {\n`;
                } else if (token.startsWith('{/each}')) {
                    const info = eachStack.pop();
                    if (info && info.indexVar) {
                        compiled += `    ${info.indexVar}++;\n`;
                    }
                    compiled += `  }\n}\n`;
                } else if (token.startsWith('{')) {
                    const expr = match[8];
                    if (expr) {
                        compiled += `out += (${expr} !== undefined && ${expr} !== null ? ${expr} : "");\n`;
                    }
                }

                lastIndex = regex.lastIndex;
            }

            const remaining = templateStr.slice(lastIndex);
            if (remaining) {
                compiled += `out += "${escapeString(remaining)}";\n`;
            }
            compiled += 'return out;\n';

            const fnBody = `
                with (context) {
                    try {
                        ${compiled}
                    } catch (innerErr) {
                        console.warn('[Dolphin Template Eval Warning]:', innerErr);
                        return '';
                    }
                }
            `;
            const fn = new Function('context', fnBody);
            return fn(context);
        } catch (e) {
            console.error('[Dolphin Template Compiler Error]:', e);
            // Fallback: simple replace of double mustache keys
            let fallback = templateStr;
            for (let key in context) {
                const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                fallback = fallback.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g'), context[key] !== undefined && context[key] !== null ? context[key] : '');
            }
            return fallback;
        }
    }

    // ─── PHASE 1: PERFORMANCE & SECURITY HELPERS ──────────────────────────────

    // 1. Zero-dependency Browser HTML Sanitizer against XSS
    function sanitizeHTML(html: string): string {
        if (typeof document === 'undefined') return html;
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const body = doc.body;

            const sanitizeNode = (el: Element) => {
                const tag = el.tagName.toLowerCase();
                if (['script', 'iframe', 'object', 'embed', 'link', 'style', 'meta', 'applet', 'svg'].includes(tag)) {
                    el.parentNode?.removeChild(el);
                    return;
                }

                const attrs = el.attributes;
                for (let i = attrs.length - 1; i >= 0; i--) {
                    const attrName = attrs[i].name.toLowerCase();
                    const attrVal = attrs[i].value.toLowerCase();

                    if (attrName.startsWith('on')) {
                        el.removeAttribute(attrs[i].name);
                    } else if (['src', 'href', 'data'].includes(attrName) && (attrVal.includes('javascript:') || attrVal.includes('data:text/html'))) {
                        el.removeAttribute(attrs[i].name);
                    }
                }
                Array.from(el.children).forEach(sanitizeNode);
            };

            Array.from(body.children).forEach(sanitizeNode);
            return body.innerHTML;
        } catch {
            return html; // fallback
        }
    }

    // 2. Browser-native DOM Reconciliation Engine (Virtual DOM Diffing equivalent)
    function diffDOM(existingNode: Node, newNode: Node) {
        if (existingNode.nodeType !== newNode.nodeType) {
            existingNode.parentNode?.replaceChild(newNode.cloneNode(true), existingNode);
            return;
        }

        if (existingNode.nodeType === Node.TEXT_NODE) {
            if (existingNode.textContent !== newNode.textContent) {
                existingNode.textContent = newNode.textContent;
            }
            return;
        }

        if (existingNode.nodeType === Node.ELEMENT_NODE) {
            const el1 = existingNode as Element;
            const el2 = newNode as Element;

            if (el1.tagName !== el2.tagName) {
                el1.parentNode?.replaceChild(el2.cloneNode(true), el1);
                return;
            }

            const attr1 = el1.attributes;
            const attr2 = el2.attributes;

            for (let i = attr1.length - 1; i >= 0; i--) {
                const name = attr1[i].name;
                if (!el2.hasAttribute(name)) el1.removeAttribute(name);
            }

            for (let i = 0; i < attr2.length; i++) {
                const name = attr2[i].name;
                const val = attr2[i].value;
                if (el1.getAttribute(name) !== val) el1.setAttribute(name, val);
            }

            if (el1.tagName === 'INPUT' || el1.tagName === 'TEXTAREA') {
                if ((el1 as any).value !== (el2 as any).value) (el1 as any).value = (el2 as any).value;
                if ((el1 as any).checked !== (el2 as any).checked) (el1 as any).checked = (el2 as any).checked;
            } else if (el1.tagName === 'SELECT') {
                if ((el1 as any).value !== (el2 as any).value) (el1 as any).value = (el2 as any).value;
            }

            const childs1 = Array.from(el1.childNodes);
            const childs2 = Array.from(el2.childNodes);

            const len1 = childs1.length;
            const len2 = childs2.length;
            const maxLen = Math.max(len1, len2);

            for (let i = 0; i < maxLen; i++) {
                if (i >= len1) {
                    el1.appendChild(childs2[i].cloneNode(true));
                } else if (i >= len2) {
                    el1.removeChild(childs1[i]);
                } else {
                    diffDOM(childs1[i], childs2[i]);
                }
            }
        }
    }

    function patchDOM(parentElement: Element, newHTML: string) {
        if (typeof document === 'undefined') return;
        const temp = document.createElement(parentElement.tagName);
        temp.innerHTML = newHTML;

        const childs1 = Array.from(parentElement.childNodes);
        const childs2 = Array.from(temp.childNodes);

        const len1 = childs1.length;
        const len2 = childs2.length;
        const maxLen = Math.max(len1, len2);

        for (let i = 0; i < maxLen; i++) {
            if (i >= len1) {
                parentElement.appendChild(childs2[i].cloneNode(true));
            } else if (i >= len2) {
                parentElement.removeChild(childs1[i]);
            } else {
                diffDOM(childs1[i], childs2[i]);
            }
        }
    }

    // 3. Batched Updates Scheduler using requestAnimationFrame
    const pendingUpdates = new Map<Element, string>();
    let rafScheduled = false;

    function scheduleDOMUpdate(element: Element, newHTML: string) {
        pendingUpdates.set(element, newHTML);
        if (!rafScheduled) {
            rafScheduled = true;
            const scheduleFn = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : (cb: () => void) => setTimeout(cb, 0);
            scheduleFn(() => {
                pendingUpdates.forEach((html, el) => {
                    patchDOM(el, html);
                });
                pendingUpdates.clear();
                rafScheduled = false;
            });
        }
    }

    // ─── PHASE 3: GLOBAL REACTIVE STORES ──────────────────────────────────────
    clientProto.setStoreState = function(storeName: string, key: string, val: any) {
        this.uiStores = this.uiStores || new Map<string, Record<string, any>>();
        if (!this.uiStores.has(storeName)) {
            this.uiStores.set(storeName, {});
        }
        const store = this.uiStores.get(storeName);
        store[key] = val;

        if (typeof document !== 'undefined') {
            const readElements = document.querySelectorAll(`[data-store-read="${storeName}.${key}"]`);
            readElements.forEach((el: any) => {
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
    };

    clientProto.getStoreState = function(storeName: string, key: string) {
        this.uiStores = this.uiStores || new Map<string, Record<string, any>>();
        const store = this.uiStores.get(storeName);
        return store ? store[key] : undefined;
    };

    clientProto._scanStoreBinds = function() {
        if (typeof document === 'undefined') return;
        
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
                    if (!this.uiStores.has(storeName)) {
                        this.uiStores.set(storeName, {});
                    }
                    const store = this.uiStores.get(storeName);
                    if (store[key] === undefined) {
                        store[key] = val;
                    }
                }
            }
        });

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
                            if (el.type === 'checkbox') {
                                el.checked = !!val;
                            } else {
                                el.value = val;
                            }
                        } else {
                            el.textContent = val;
                        }
                    }
                }
            }
        });
    };

    // ──────────────────────────────────────────────────────────────────────────

    clientProto.getClosestContext = function(element: Element, key?: string) {
        let current: any = element;
        while (current) {
            if (current._rtContext) {
                const ctx = current._rtContext;
                if (key) return ctx[key];
                return ctx;
            }
            current = current.parentElement;
        }
        return null;
    };

    clientProto._executeStoreAction = function(expression: string, element?: Element) {
        this.uiStores = this.uiStores || new Map<string, Record<string, any>>();
        
        const context = new Proxy({}, {
            has: (target, prop) => {
                return true; // Pretend we have every store name!
            },
            get: (target, prop) => {
                if (typeof prop === 'string') {
                    return new Proxy({}, {
                        get: (subTarget, subProp) => {
                            if (typeof subProp === 'string') {
                                return this.getStoreState(prop, subProp);
                            }
                        },
                        set: (subTarget, subProp, val) => {
                            if (typeof subProp === 'string') {
                                this.setStoreState(prop, subProp, val);
                                return true;
                            }
                            return false;
                        }
                    });
                }
            }
        });

        try {
            const fn = new Function('ctx', `with(ctx) { ${expression} }`);
            fn(context);
        } catch (err) {
            console.error('%c[Dolphin Store Action Error]:', 'color: #ef4444; font-weight: bold;', err);
            if (element) {
                console.error('%cFailed Element:', 'color: #f97316; font-weight: bold;', element);
            }
            console.error('%cFailed Expression:', 'color: #3b82f6; font-style: italic;', expression);
        }
    };

    /** @private */
    clientProto._initDOMBinding = function() {
        if (this._domInitialized) return;
        this._domInitialized = true;

        // 1. Listen for inputs and value changes with dynamic debouncing
        const PUSH_EVENTS = ['input', 'change', 'keyup', 'paste', 'blur'];
        const debounceTimers = new Map<Element, any>();

        PUSH_EVENTS.forEach(evtName => {
            this.addDomListener(document, evtName, (e: any) => {
                if (!e.target || !e.target.getAttribute) return;

                // 1. data-store-write reactive store bindings
                const writeBind = e.target.getAttribute('data-store-write');
                if (writeBind) {
                    const parts = writeBind.split('.');
                    if (parts.length === 2) {
                        const storeName = parts[0];
                        const key = parts[1];
                        const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                        this.setStoreState(storeName, key, val);
                    }
                }

                // 2. data-rt-validate dynamic validation
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

                // 3. data-rt-push topic updates
                const topic = e.target.getAttribute('data-rt-push');
                if (topic) {
                    const debounceVal = e.target.getAttribute('data-rt-debounce');
                    const waitMs = debounceVal ? parseInt(debounceVal, 10) : 0;

                    const triggerPush = () => {
                        const payload = { name: e.target.name, value: e.target.value };
                        this.pubPush(topic, payload);
                    };

                    if (waitMs > 0) {
                        if (debounceTimers.has(e.target)) {
                            clearTimeout(debounceTimers.get(e.target));
                        }
                        const timer = setTimeout(triggerPush, waitMs);
                        debounceTimers.set(e.target, timer);
                    } else {
                        triggerPush();
                    }
                }
            });
        });

        // 2. Listen for form submits (RT + API) - Serializes whole form data
        this.addDomListener(document, 'submit', async (e: any) => {
            if (!e.target || !e.target.getAttribute) return;
            
            const rtTopic = e.target.getAttribute('data-rt-submit');
            const apiTarget = e.target.getAttribute('data-api-submit');
            
            if (rtTopic || apiTarget) {
                // Perform form validation first if there are validated inputs
                const validatedInputs = e.target.querySelectorAll('[data-rt-validate]');
                let formIsValid = true;
                if (validatedInputs.length > 0 && typeof this.validateField === 'function') {
                    const formValues = Object.fromEntries(new (FormData as any)(e.target).entries());
                    validatedInputs.forEach((inputEl: any) => {
                        const rules = inputEl.getAttribute('data-rt-validate');
                        const name = inputEl.name;
                        if (rules && name) {
                            const errorMsg = this.validateField(inputEl.value, rules, formValues as any);
                            if (errorMsg) {
                                formIsValid = false;
                                inputEl.classList.add('invalid');
                                this.publish(`errors/${name}`, errorMsg);
                            } else {
                                inputEl.classList.remove('invalid');
                                this.publish(`errors/${name}`, '');
                            }
                        }
                    });
                }

                if (!formIsValid) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }

                e.preventDefault();
                const parentCtx = this.getClosestContext(e.target) || {};
                const formData = new (FormData as any)(e.target);
                const data = Object.fromEntries(formData.entries());
                
                if (rtTopic) {
                    let resolvedTopic = rtTopic;
                    for (const k in parentCtx) {
                        const escapedK = escapeRegExp(k);
                        resolvedTopic = resolvedTopic.replace(new RegExp(`\\{\\{${escapedK}\\}\\}`, 'g'), parentCtx[k] !== undefined && parentCtx[k] !== null ? parentCtx[k] : '');
                    }
                    this.publish(resolvedTopic, data);
                } else if (apiTarget) {
                    let resolvedTarget = apiTarget;
                    for (const k in parentCtx) {
                        const escapedK = escapeRegExp(k);
                        resolvedTarget = resolvedTarget.replace(new RegExp(`\\{\\{${escapedK}\\}\\}`, 'g'), parentCtx[k] !== undefined && parentCtx[k] !== null ? parentCtx[k] : '');
                    }
                    const parts = resolvedTarget.trim().split(' ');
                    const method = parts.length > 1 ? parts[0].toUpperCase() : 'POST';
                    const path = parts.length > 1 ? parts[1] : parts[0];
                    try {
                        const result = await this.api.request(method, path, data);
                        const resultBind = e.target.getAttribute('data-api-result');
                        if (resultBind) this._updateDOM(resultBind, result);
                        
                        // Auto Navigation (Hookless Routing)
                        const redirect = e.target.getAttribute('data-api-redirect');
                        if (redirect) window.location.href = redirect;
                        if (e.target.hasAttribute('data-api-reload')) window.location.reload();
                    } catch (err) {
                        console.error('[Dolphin] API Submit Error:', err);
                    }
                }
            }
        });

        // 3. Unified listener for custom interaction events (click, change, keydown, keyup, dblclick, etc.)
        const INTERACTION_EVENTS = ['click', 'change', 'submit', 'input', 'keydown', 'keyup', 'dblclick', 'focus', 'blur', 'mouseenter', 'mouseleave'];
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
                            resolvedDataStr = resolvedDataStr.replace(new RegExp(`\\{\\{${escapedK}\\}\\}`, 'g'), parentCtx[k] !== undefined && parentCtx[k] !== null ? parentCtx[k] : '');
                        }
                        try {
                            payload = JSON.parse(resolvedDataStr);
                        } catch {
                            payload = {};
                        }
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
                    let payload = null;
                    if (actionData) {
                        let resolvedDataStr = actionData;
                        for (const k in parentCtx) {
                            const escapedK = escapeRegExp(k);
                            resolvedDataStr = resolvedDataStr.replace(new RegExp(`\\{\\{${escapedK}\\}\\}`, 'g'), parentCtx[k] !== undefined && parentCtx[k] !== null ? parentCtx[k] : '');
                        }
                        try {
                            payload = JSON.parse(resolvedDataStr);
                        } catch {
                            payload = null;
                        }
                    }
                    try {
                        const result = await this.api.request(method, path, payload);
                        const resultBind = apiBtn.getAttribute('data-api-result');
                        if (resultBind) this._updateDOM(resultBind, result);
                        
                        // Auto Navigation (Hookless Routing)
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
                    if (expr) {
                        this._executeStoreAction(expr, storeActionBtn);
                    }
                }
            });
        });

        // 4. Update DOM when RT data arrives
        // Note: Subscribe to all topics ('#') to auto-update DOM bindings
        this.subscribe('#', (payload: any, topic: string) => {
            this._updateDOM(topic, payload);
        });

        // 5. Auto-fetch API GET bindings
        this._scanAndFetchAPIBinds();

        // 6. Scan and initialize local reactive stores
        this._scanStoreBinds();
    };

    /** @private */
    clientProto._scanAndFetchAPIBinds = async function() {
        if (typeof document === 'undefined') return;
        const elements = document.querySelectorAll('[data-api-get]');
        for (const el of Array.from(elements)) {
            const path = el.getAttribute('data-api-get');
            if (!path) continue;
            try {
                const result = await this.api.get(path);
                const rtBind = el.getAttribute('data-rt-bind');
                
                if (rtBind) {
                    // Route initial HTTP result through the _updateDOM renderer for full template/context support
                    this._updateDOM(rtBind, result);
                } else {
                    const template = resolveTemplate(el);
                    if (template && typeof result === 'object' && result !== null) {
                        if (Array.isArray(result)) {
                            let combinedHTML = '';
                            for (const item of result) {
                                combinedHTML += renderTemplate(template, item);
                            }
                            scheduleDOMUpdate(el, combinedHTML);
                        } else {
                            scheduleDOMUpdate(el, renderTemplate(template, result));
                        }
                    } else {
                        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                            (el as any).value = typeof result === 'object' ? (result.value !== undefined ? result.value : '') : result;
                        } else {
                            el.innerHTML = typeof result === 'object' ? (result.html || result.text || JSON.stringify(result)) : result;
                        }
                    }
                }
            } catch(e) {
                console.error('[Dolphin] API Get Error:', e);
            }
        }
    };

    /** @private */
    clientProto._updateDOM = function(topic: string, payload: any) {
        if (typeof document === 'undefined') return;
        const elements = document.querySelectorAll(`[data-rt-bind="${topic}"]`);
        elements.forEach(el => {
            if (el.getAttribute('data-rt-type') === 'context' && typeof payload === 'object' && payload !== null) {
                (el as any)._rtContext = payload; // Store context on DOM element
                const processNode = (node: Element) => {
                    if (node.hasAttribute('data-rt-text')) {
                        const key = node.getAttribute('data-rt-text');
                        if (key && payload[key] !== undefined && payload[key] !== null) node.textContent = payload[key];
                    }
                    if (node.hasAttribute('data-rt-html')) {
                        const key = node.getAttribute('data-rt-html');
                        if (key && payload[key] !== undefined && payload[key] !== null) {
                            node.innerHTML = sanitizeHTML(payload[key]); // Sanitized against XSS!
                        }
                    }
                    if (node.hasAttribute('data-rt-attr')) {
                        const attrStr = node.getAttribute('data-rt-attr');
                        if (attrStr) {
                            attrStr.split(',').forEach(b => {
                                const parts = b.split(':');
                                if (parts.length === 2) {
                                    const attrName = parts[0].trim();
                                    const key = parts[1].trim();
                                    if (attrName && key && payload[key] !== undefined && payload[key] !== null) {
                                        node.setAttribute(attrName, payload[key]);
                                    }
                                }
                            });
                        }
                    }
                    if (node.hasAttribute('data-rt-class')) {
                        const classStr = node.getAttribute('data-rt-class');
                        if (classStr) {
                            classStr.split(',').forEach(b => {
                                const parts = b.split(':');
                                if (parts.length === 2) {
                                    const className = parts[0].trim();
                                    const key = parts[1].trim();
                                    if (payload[key]) {
                                        node.classList.add(className);
                                    } else {
                                        node.classList.remove(className);
                                    }
                                }
                            });
                        }
                    }
                    if (node.hasAttribute('data-rt-if')) {
                        const key = node.getAttribute('data-rt-if');
                        if (key) {
                            if (payload[key]) {
                                (node as HTMLElement).style.display = '';
                            } else {
                                (node as HTMLElement).style.display = 'none';
                            }
                        }
                    }
                    if (node.hasAttribute('data-rt-hide')) {
                        const key = node.getAttribute('data-rt-hide');
                        if (key) {
                            if (payload[key]) {
                                (node as HTMLElement).style.display = 'none';
                            } else {
                                (node as HTMLElement).style.display = '';
                            }
                        }
                    }
                };
                processNode(el);
                el.querySelectorAll('[data-rt-text], [data-rt-html], [data-rt-attr], [data-rt-class], [data-rt-if], [data-rt-hide]').forEach(processNode);
                return;
            }

            const template = resolveTemplate(el);
            
            if (template && typeof payload === 'object' && payload !== null) {
                if (Array.isArray(payload)) {
                    let combinedHTML = '';
                    for (const item of payload) {
                        combinedHTML += renderTemplate(template, item);
                    }
                    scheduleDOMUpdate(el, combinedHTML); // Batched update + VDOM Diffing!
                } else {
                    scheduleDOMUpdate(el, renderTemplate(template, payload)); // Batched update + VDOM Diffing!
                }
                return;
            }

            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                (el as any).value = typeof payload === 'object' ? (payload.value !== undefined ? payload.value : '') : payload;
            } else {
                el.innerHTML = typeof payload === 'object' ? (payload.html || payload.text || JSON.stringify(payload)) : payload;
            }
        });
    };
}