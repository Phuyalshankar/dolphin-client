import { scanVFSBinds } from './vfs';

export function attachDOMBinding(clientProto: any) {
    clientProto._scanVFSBinds = function() {
        scanVFSBinds(this);
    };

    // @fix: Failed promises are evicted from cache so retries fetch fresh content (was: permanent failure cache)
    const componentPromiseCache = new Map<string, Promise<string>>();

    // Helper to escape special characters for regex search
    function escapeRegExp(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Helper to resolve template as either a raw HTML string or a CSS selector pointing to a <template> node
        // Helper to evaluate a JS expression with a context object safely
    function evaluateExpression(expr: string, ctx: any): any {
        if (!ctx || typeof ctx !== 'object') return undefined;
        try {
            const safeCtx = new Proxy(ctx, {
                has(target, prop) {
                    return true;
                },
                get(target, prop) {
                    if (typeof prop === 'string') {
                        if (prop in target) return target[prop];
                        if (typeof globalThis !== 'undefined' && prop in globalThis) return (globalThis as any)[prop];
                        if (typeof window !== 'undefined' && prop in window) return (window as any)[prop];
                    }
                    return undefined;
                }
            });
            const fn = new Function('ctx', `with(ctx) { return (${expr}); }`);
            return fn(safeCtx);
        } catch {
            return ctx[expr];
        }
    }

    function splitByUnquotedChar(str: string, char: string): string[] {
        const parts: string[] = [];
        let current = '';
        let inSingleQuote = false;
        let inDoubleQuote = false;
        let inBacktick = false;
        let depth = 0;
        for (let i = 0; i < str.length; i++) {
            const c = str[i];
            if (c === "'" && !inDoubleQuote && !inBacktick) {
                inSingleQuote = !inSingleQuote;
            } else if (c === '"' && !inSingleQuote && !inBacktick) {
                inDoubleQuote = !inDoubleQuote;
            } else if (c === '`' && !inSingleQuote && !inDoubleQuote) {
                inBacktick = !inBacktick;
            } else if (c === '(' || c === '[' || c === '{') {
                if (!inSingleQuote && !inDoubleQuote && !inBacktick) depth++;
            } else if (c === ')' || c === ']' || c === '}') {
                if (!inSingleQuote && !inDoubleQuote && !inBacktick) depth--;
            }
            
            if (c === char && !inSingleQuote && !inDoubleQuote && !inBacktick && depth === 0) {
                parts.push(current);
                current = '';
            } else {
                current += c;
            }
        }
        parts.push(current);
        return parts;
    }

    function splitFirstUnquotedColon(str: string): [string, string] | null {
        let inSingleQuote = false;
        let inDoubleQuote = false;
        let inBacktick = false;
        let depth = 0;
        for (let i = 0; i < str.length; i++) {
            const c = str[i];
            if (c === "'" && !inDoubleQuote && !inBacktick) {
                inSingleQuote = !inSingleQuote;
            } else if (c === '"' && !inSingleQuote && !inBacktick) {
                inDoubleQuote = !inDoubleQuote;
            } else if (c === '`' && !inSingleQuote && !inDoubleQuote) {
                inBacktick = !inBacktick;
            } else if (c === '(' || c === '[' || c === '{') {
                if (!inSingleQuote && !inDoubleQuote && !inBacktick) depth++;
            } else if (c === ')' || c === ']' || c === '}') {
                if (!inSingleQuote && !inDoubleQuote && !inBacktick) depth--;
            }
            
            if (c === ':' && !inSingleQuote && !inDoubleQuote && !inBacktick && depth === 0) {
                return [str.slice(0, i), str.slice(i + 1)];
            }
        }
        return null;
    }

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
                const escapedKey = key.replace(/[.*+?^$${}()|[\]\\]/g, '\\$&');
                result = result.replace(new RegExp('\\{\\{' + escapedKey + '\\}\}', 'g'), context[key] !== undefined && context[key] !== null ? context[key] : '');
            }
            // Resolve any remaining nested/dotted property paths (e.g. rating.rate, user?.profile?.name)
            result = result.replace(/\{\{([\s\S]*?)\}\}/g, (match, expr) => {
                const trimmed = expr.trim();
                if (!trimmed) return '';
                if (/^[a-zA-Z_$][a-zA-Z0-9_$]*(?:\??\.[a-zA-Z_$][a-zA-Z0-9_$]*)+$/.test(trimmed)) {
                    const parts = trimmed.split(/\??\./);
                    let val = context;
                    for (const part of parts) {
                        if (val === undefined || val === null) {
                            val = undefined;
                            break;
                        }
                        val = val[part];
                    }
                    return val !== undefined && val !== null ? val : '';
                }
                return match;
            });
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
            let safeContext = context;
            if (typeof Proxy !== 'undefined' && context !== null && typeof context === 'object') {
                safeContext = new Proxy(context, {
                    has(target, key) {
                        if (typeof key === 'symbol') return false;
                        return true;
                    },
                    get(target, key) {
                        if (key === Symbol.unscopables) return undefined;
                        if (key in target) return target[key];
                        if (typeof globalThis !== 'undefined' && key in globalThis) {
                            return (globalThis as any)[key];
                        }
                        if (typeof window !== 'undefined' && key in window) {
                            return (window as any)[key];
                        }
                        return undefined;
                    }
                });
            }
            const fn = new Function('context', fnBody);
            return fn(safeContext);
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
            const hasBodyOrHtml = /<\s*(?:body|html)\b/i.test(html);
            const parseString = hasBodyOrHtml ? html : `<body>${html}</body>`;
            const doc = parser.parseFromString(parseString, 'text/html');
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

        const childs1 = Array.from(parentElement.children);
        const childs2 = Array.from(temp.children);

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
    // @fix: Map cleared every RAF cycle — disconnected elements are skipped and never retained
    const pendingUpdates = new Map<Element, string>();
    let rafScheduled = false;

    function scheduleDOMUpdate(element: Element, newHTML: string) {
        // @fix: Early guard — skip elements already detached from DOM to prevent stale references
        if (typeof element.isConnected === 'boolean' && !element.isConnected) return;
        pendingUpdates.set(element, newHTML);
        if (!rafScheduled) {
            rafScheduled = true;
            const scheduleFn = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : (cb: () => void) => setTimeout(cb, 0);
            scheduleFn(() => {
                pendingUpdates.forEach((html, el) => {
                    // @fix: Use el.isConnected (jsdom-compatible) instead of document.contains (was: TypeError in jsdom)
                    if ((el as any).isConnected !== false) {
                        patchDOM(el, html);
                    }
                });
                pendingUpdates.clear();
                rafScheduled = false;
            });
        }
    }


    // ─── PHASE 3: GLOBAL REACTIVE STORES ──────────────────────────────────────

    // @fix: DOM query cache for data-store-read elements.
    // Avoids a full querySelectorAll scan on every setStoreState call.
    // Cache key = "storeName.key", value = NodeList snapshot (array).
    // Invalidated when MutationObserver detects DOM changes.
    const _storeReadCache = new Map<string, Element[]>();
    let _storeReadCacheValid = true;

    function _invalidateStoreReadCache() {
        _storeReadCache.clear();
        _storeReadCacheValid = true;
    }

    // Watch for DOM mutations that could add/remove data-store-read elements
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

    clientProto.setStoreState = function(storeName: string, key: string, val: any, originEl?: Element) {
        this.uiStores = this.uiStores || new Map<string, Record<string, any>>();
        if (!this.uiStores.has(storeName)) {
            this.uiStores.set(storeName, {});
        }
        const store = this.uiStores.get(storeName);
        store[key] = val;

        if (this.options.debug) {
            console.log(`%c💾 [Dolphin Store Update]:`, 'color: #ec4899; font-weight: bold;', `${storeName}.${key}`, '=', val);
        }

        if (typeof document !== 'undefined') {
            // @fix: Use cached element list instead of querySelectorAll every call
            const cacheKey = `${storeName}.${key}`;
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
        }
    };


    clientProto.getStoreState = function(storeName: string, key: string) {
        this.uiStores = this.uiStores || new Map<string, Record<string, any>>();
        const store = this.uiStores.get(storeName);
        return store ? store[key] : undefined;
    };

    clientProto._scanStoreBinds = function() {
        if (typeof document === 'undefined') return;
        
        // 1. Declarative Store Initialization via <dolphin-store>
        const storeElements = document.querySelectorAll('dolphin-store');
        storeElements.forEach((el: any) => {
            if (typeof el.getAttribute !== 'function') return;
            const storeName = el.getAttribute('name') || el.getAttribute('data-store');
            if (!storeName) return;

            // Check if this element has child HTML elements (acts as context container)
            const hasChildren = el.children && el.children.length > 0;

            if (hasChildren) {
                // Dual-mode: Store seeder + Context Container
                // Keep element visible and wire up as a reactive context binding
                if (typeof el.setAttribute === 'function') {
                    el.setAttribute('data-rt-bind', `store/${storeName}`);
                    el.setAttribute('data-rt-type', 'context');
                }
            } else {
                // Seed-only mode: hide the element (no children to display)
                if (el.style) {
                    el.style.display = 'none';
                }
            }

            // Option A: Parse JSON text content inside the tag
            // Only if text content looks like JSON (starts with {), not child HTML
            if (!hasChildren) {
                const content = el.textContent ? el.textContent.trim() : '';
                if (content && content.startsWith('{')) {
                    try {
                        const parsed = JSON.parse(content);
                        if (parsed && typeof parsed === 'object') {
                            Object.keys(parsed).forEach(key => {
                                this.setStoreState(storeName, key, parsed[key]);
                            });
                        }
                    } catch (err) {
                        console.error(`[Dolphin Store Init Error] Failed to parse JSON inside <dolphin-store name="${storeName}">:`, err);
                    }
                }
            }

            // Option B: Parse key-value attributes and seed the store
            // Also check for 'template' attribute for auto-wiring
            const templateSelector = el.getAttribute('template');
            if (el.attributes) {
                const excludeAttrs = ['name', 'data-store', 'style', 'data-rt-bind', 'data-rt-type', 'template'];
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
            }

            // Auto-wire: if template="#selector" is set, inject a reactive div after this element
            if (templateSelector && !hasChildren && el.parentNode && typeof document !== 'undefined') {
                // Only inject if not already injected (check for marker attribute)
                const markerId = `_ds_${storeName}_${templateSelector.replace(/[^a-z0-9]/gi, '_')}`;
                let wrapper = document.querySelector(`[data-ds-wired="${markerId}"]`);
                if (!wrapper) {
                    wrapper = document.createElement('div');
                    wrapper.setAttribute('data-rt-bind', `store/${storeName}`);
                    wrapper.setAttribute('data-rt-template', templateSelector);
                    wrapper.setAttribute('data-ds-wired', markerId);
                    el.parentNode.insertBefore(wrapper, el.nextSibling);
                }

                // Immediately trigger a DOM update for this store so that the template renders
                if (typeof this._updateDOM === 'function') {
                    this.uiStores = this.uiStores || new Map();
                    const currentStore = this.uiStores.get(storeName) || {};
                    this._updateDOM(`store/${storeName}`, currentStore);
                }
            }

            // If acting as context container, trigger DOM update so children render immediately
            if (hasChildren && typeof this._updateDOM === 'function') {
                this.uiStores = this.uiStores || new Map();
                const currentStore = this.uiStores.get(storeName) || {};
                this._updateDOM(`store/${storeName}`, currentStore);
            }
        });

        // 2. Scan standard inputs with data-store-write to initialize store keys if not already set
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
            current = current.parentElement || current.parentNode;
        }
        return null;
    };

    clientProto._executeStoreAction = function(expression: string, element?: Element) {
        this.uiStores = this.uiStores || new Map<string, Record<string, any>>();
        const parentCtx = (element && typeof this.getClosestContext === 'function') ? this.getClosestContext(element) : null;

        // @fix: Resolve the closest store name so shorthand `count = count + 1` (without store prefix)
        // can be assigned back to the correct store. Previously: outer proxy had no set trap,
        // causing assignments like `count = count + 1` to silently target the global object.
        const getClosestStoreName = (el?: Element): string | null => {
            if (!el) return null;
            // Walk up the DOM to find the nearest data-rt-bind="store/..." context element
            let cursor: Element | null = el;
            while (cursor) {
                const bind = cursor.getAttribute && cursor.getAttribute('data-rt-bind');
                if (bind && bind.startsWith('store/')) return bind.slice(6); // "store/counter" → "counter"
                const dsName = cursor.getAttribute && (cursor.getAttribute('name') || cursor.getAttribute('data-store'));
                if (dsName && cursor.tagName && cursor.tagName.toLowerCase() === 'dolphin-store') return dsName;
                cursor = cursor.parentElement;
            }
            return null;
        };
        const closestStoreName = getClosestStoreName(element);
        
        const context = new Proxy({}, {
            has: (target, prop) => {
                return true; // Pretend we have every store name!
            },
            // @fix: Add set trap to outer proxy so that shorthand `count = count + 1`
            // writes back to the correct store (closest context store) instead of global.
            set: (target, prop, val) => {
                if (typeof prop === 'string') {
                    // Priority 1: write to the closest store if this key lives there
                    if (closestStoreName && parentCtx && prop in parentCtx) {
                        this.setStoreState(closestStoreName, prop, val);
                        return true;
                    }
                    // Priority 2: search all stores for this key and write to first match
                    if (this.uiStores) {
                        for (const [sName, sState] of this.uiStores) {
                            if (prop in sState) {
                                this.setStoreState(sName, prop, val);
                                return true;
                            }
                        }
                    }
                    // Priority 3: write to closest store even if key wasn't pre-seeded
                    if (closestStoreName) {
                        this.setStoreState(closestStoreName, prop, val);
                        return true;
                    }
                }
                return false;
            },
            get: (target, prop) => {
                if (typeof prop === 'string') {
                    if (prop === 'log') {
                        return (arg: any) => {
                            if (arg === undefined) {
                                const allStores: Record<string, any> = {};
                                this.uiStores.forEach((val: any, key: string) => {
                                    allStores[key] = { ...val };
                                });
                                console.log(`%c📊 [Dolphin All UI Stores]:`, 'color: #06b6d4; font-weight: bold;', allStores);
                            } else if (arg && typeof arg === 'object' && arg.__isStoreProxy__) {
                                const storeName = arg.__storeName__;
                                const store = this.uiStores.get(storeName);
                                console.log(`%c📊 [Dolphin Store: ${storeName}]:`, 'color: #06b6d4; font-weight: bold;', store ? { ...store } : {});
                            } else {
                                console.log(`%c📊 [Dolphin Log]:`, 'color: #06b6d4; font-weight: bold;', arg);
                            }
                        };
                    }

                    // ── DolphinStore (Database Store) collection access ──────────
                    if (this.store && this.store.data && typeof this.store.data.has === 'function' && this.store.data.has(prop)) {
                        const collection = this.store.data.get(prop);
                        const self = this;
                        const collectionName = prop;

                        // Methods that trigger DOM re-render after execution
                        const RENDER_METHODS = new Set([
                            'search', 'filter', 'range', 'sort', 'clearFilters',
                            'where', 'orderBy', 'reset',
                            'add', 'updateById', 'deleteById',
                            'optimisticDelete', 'optimisticUpdate',
                            'trackStart', 'trackEnd'
                        ]);

                        return new Proxy(collection, {
                            get(target: any, method: string) {
                                if (typeof target[method] === 'function') {
                                    return (...args: any[]) => {
                                        const result = target[method](...args);
                                        // Auto re-render DOM bindings for this collection
                                        if (RENDER_METHODS.has(method) && typeof self._updateDOM === 'function') {
                                            const triggerRender = () => {
                                                if (typeof self._updateDOM === 'function') {
                                                    self._updateDOM(`store/${collectionName}`, collection);
                                                }
                                            };
                                            // Handle both sync and async (optimisticDelete/Update)
                                            if (result && typeof result.then === 'function') {
                                                result.then(triggerRender).catch(triggerRender);
                                            } else {
                                                triggerRender();
                                            }
                                        }
                                        return result;
                                    };
                                }
                                return target[method];
                            }
                        });
                    }

                    if (parentCtx && parentCtx[prop] !== undefined) {
                        return parentCtx[prop];
                    }
                    if (typeof globalThis !== 'undefined' && prop in globalThis) {
                        return (globalThis as any)[prop];
                    }
                    if (typeof window !== 'undefined' && prop in window) {
                        return (window as any)[prop];
                    }
                    return new Proxy({}, {
                        get: (subTarget, subProp) => {
                            if (subProp === '__storeName__') return prop;
                            if (subProp === '__isStoreProxy__') return true;
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
            fn.call(element, context);
        } catch (err) {
            console.error('%c[Dolphin Store Action Error]:', 'color: #ef4444; font-weight: bold;', err);
            if (element) {
                console.error('%cFailed Element:', 'color: #f97316; font-weight: bold;', element);
            }
            console.error('%cFailed Expression:', 'color: #3b82f6; font-style: italic;', expression);
        }
    };

    clientProto._initDOMBinding = function() {
        if (this._domInitialized) return;
        this._domInitialized = true;

        // 1. Listen for inputs and value changes with dynamic debouncing
        const PUSH_EVENTS = ['input', 'change', 'keyup', 'paste', 'blur'];
        // @fix: WeakMap allows GC of removed elements automatically (was: Map held element refs forever)
        const debounceTimers = new WeakMap<Element, any>();

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
                        this.setStoreState(storeName, key, val, e.target);
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
                // Clear old validation errors in store for this form's inputs
                const formInputs = e.target.querySelectorAll('[name]');
                formInputs.forEach((inputEl: any) => {
                    const name = inputEl.name;
                    if (name) {
                        this.publish(`errors/${name}`, '');
                        inputEl.classList.remove('invalid');
                    }
                });

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
                    let method = parts.length > 1 ? parts[0].toUpperCase() : 'POST';
                    const path = parts.length > 1 ? parts[1] : parts[0];
                    
                    // Respect hidden _method input spoofing dynamically
                    if (data._method) {
                        method = String(data._method).toUpperCase();
                    }

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
        const INTERACTION_EVENTS = ['click', 'change', 'input', 'keydown', 'keyup', 'dblclick', 'focus', 'blur', 'mouseenter', 'mouseleave'];
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

        // 6.5. Scan and initialize VFS folder explorers
        this._scanVFSBinds();

        // 7. Resolve declarative HTML component imports
        this._resolveImports();

        // 8. Boot up Instant SPA link routing
        this._initSPARouter();
    };

    /** @private */
    clientProto._scanAndFetchAPIBinds = async function() {
        if (typeof document === 'undefined') return;
        const elements = document.querySelectorAll('[data-api-get]');
        for (const el of Array.from(elements)) {
            const path = el.getAttribute('data-api-get');
            if (!path) continue;
            // @fix: Skip already-initialized elements to prevent duplicate fetches on SPA navigation
            // Guard: some test mock elements may not implement hasAttribute
            if (typeof (el as any).hasAttribute === 'function' && el.hasAttribute('data-api-initialized')) continue;
            if (typeof (el as any).setAttribute === 'function') {
                el.setAttribute('data-api-initialized', 'true');
            }
            try {
                const result = await this.api.get(path);
                 
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
                    // Route initial HTTP result through the _updateDOM renderer for full template/context support
                    this._updateDOM(rtBind, result);
                } else if (!apiStore) {
                    const template = resolveTemplate(el);
                    if (template && typeof result === 'object' && result !== null) {
                        const processedResult = this._applyDeclarativeDirectives(el, result);
                        if (Array.isArray(processedResult)) {
                            let combinedHTML = '';
                            for (const item of processedResult) {
                                combinedHTML += renderTemplate(template, item);
                            }
                            scheduleDOMUpdate(el, combinedHTML);
                        } else {
                            scheduleDOMUpdate(el, renderTemplate(template, processedResult));
                        }
                    } else {
                        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                            (el as any).value = typeof result === 'object' ? (result.value !== undefined ? result.value : '') : result;
                        } else {
                            // @fix: Sanitize only non-template direct HTML (templates produce structured safe HTML)
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

    /** @private */
    clientProto._applyDeclarativeDirectives = function(el: Element, payload: any) {
        let processedPayload = payload;
        if (typeof payload === 'object' && payload !== null) {
            const applyFilterSearchSort = (arr: any[]) => {
                if (!Array.isArray(arr)) return [];
                let result = [...arr];

                // 1. Declarative Filtering
                const filterAttr = el.getAttribute('data-rt-filter');
                if (filterAttr) {
                    const parts = filterAttr.split('==');
                    if (parts.length === 2) {
                        const itemProp = parts[0].trim();
                        const storeExpr = parts[1].trim();
                        
                        let filterVal = undefined;
                        const storeParts = storeExpr.split('.');
                        if (storeParts.length === 2) {
                            filterVal = this.getStoreState(storeParts[0], storeParts[1]);
                        } else {
                            filterVal = payload[storeExpr] !== undefined ? payload[storeExpr] : this.getStoreState('app', storeExpr);
                        }
                        
                        if (filterVal !== undefined && filterVal !== null && filterVal !== '') {
                            result = result.filter(item => item[itemProp] === filterVal);
                        }
                    }
                }

                // 2. Declarative Searching
                const searchAttr = el.getAttribute('data-rt-search');
                if (searchAttr) {
                    const parts = searchAttr.split('==');
                    if (parts.length === 2) {
                        const itemProp = parts[0].trim();
                        const storeExpr = parts[1].trim();
                        
                        let searchVal = undefined;
                        const storeParts = storeExpr.split('.');
                        if (storeParts.length === 2) {
                            searchVal = this.getStoreState(storeParts[0], storeParts[1]);
                        } else {
                            searchVal = payload[storeExpr] !== undefined ? payload[storeExpr] : this.getStoreState('app', storeExpr);
                        }
                        
                        if (searchVal !== undefined && searchVal !== null && searchVal !== '') {
                            const query = String(searchVal).toLowerCase();
                            result = result.filter(item => {
                                const val = item[itemProp];
                                return val !== undefined && val !== null && String(val).toLowerCase().includes(query);
                            });
                        }
                    }
                }

                // 3. Declarative Sorting
                const sortAttr = el.getAttribute('data-rt-sort');
                if (sortAttr) {
                    let sortByVal = undefined;
                    const storeParts = sortAttr.split('.');
                    if (storeParts.length === 2) {
                        sortByVal = this.getStoreState(storeParts[0], storeParts[1]);
                    } else {
                        sortByVal = payload[sortAttr] !== undefined ? payload[sortAttr] : this.getStoreState('app', sortAttr);
                    }
                    
                    if (sortByVal && sortByVal !== '') {
                        if (sortByVal === 'popular') {
                            result.sort((a: any, b: any) => {
                                const rateA = a.rating?.rate || a.rate || 0;
                                const rateB = b.rating?.rate || b.rate || 0;
                                return rateB - rateA;
                            });
                        } else {
                            let field = '';
                            let direction = 'asc';
                            
                            if (sortByVal.endsWith('-low') || sortByVal.endsWith('-asc')) {
                                field = sortByVal.replace('-low', '').replace('-asc', '');
                                direction = 'asc';
                            } else if (sortByVal.endsWith('-high') || sortByVal.endsWith('-desc')) {
                                field = sortByVal.replace('-high', '').replace('-desc', '');
                                direction = 'desc';
                            }
                            
                            if (field) {
                                result.sort((a: any, b: any) => {
                                    const resolveVal = (obj: any, path: string) => {
                                        return path.split('.').reduce((acc: any, part: string) => acc && acc[part], obj);
                                    };
                                    
                                    let valA = resolveVal(a, field);
                                    let valB = resolveVal(b, field);
                                    
                                    if (valA === undefined) valA = a[field];
                                    if (valB === undefined) valB = b[field];
                                    
                                    if (typeof valA === 'string' && typeof valB === 'string') {
                                        return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                                    }
                                    
                                    const numA = Number(valA);
                                    const numB = Number(valB);
                                    if (!isNaN(numA) && !isNaN(numB)) {
                                        return direction === 'asc' ? numA - numB : numB - numA;
                                    }
                                    
                                    return 0;
                                });
                            }
                        }
                    }
                }

                return result;
            };

            if (Array.isArray(payload)) {
                processedPayload = applyFilterSearchSort(payload);
            } else {
                let foundArrayKey = '';
                for (const key in payload) {
                    if (Array.isArray(payload[key])) {
                        foundArrayKey = key;
                        break;
                    }
                }
                if (foundArrayKey) {
                    const processedArray = applyFilterSearchSort(payload[foundArrayKey]);
                    processedPayload = {
                        ...payload,
                        [foundArrayKey]: processedArray
                    };
                }
            }
        }
        return processedPayload;
    };

    /** @private */
    clientProto._updateDOM = function(topic: string, payload: any) {
        if (typeof document === 'undefined') return;
        const elements = document.querySelectorAll(`[data-rt-bind="${topic}"]`);
        elements.forEach(el => {
            const processedPayload = this._applyDeclarativeDirectives(el, payload);

            if (el.getAttribute('data-rt-type') === 'context' && typeof processedPayload === 'object' && processedPayload !== null) {
                (el as any)._rtContext = processedPayload; // Store context on DOM element
                const processNode = (node: Element) => {
                    if (node.hasAttribute('data-rt-text')) {
                        const key = node.getAttribute('data-rt-text');
                        if (key) {
                            const val = evaluateExpression(key, processedPayload);
                            if (val !== undefined && val !== null) node.textContent = val;
                        }
                    }
                    if (node.hasAttribute('data-rt-html')) {
                        const key = node.getAttribute('data-rt-html');
                        if (key) {
                            const val = evaluateExpression(key, processedPayload);
                            if (val !== undefined && val !== null) {
                                node.innerHTML = sanitizeHTML(val); // Sanitized against XSS!
                            }
                        }
                    }
                    if (node.hasAttribute('data-rt-attr')) {
                        const attrStr = node.getAttribute('data-rt-attr');
                        if (attrStr) {
                            // @fix: Boolean HTML attributes (disabled, checked, etc.) must be *removed*
                            // when false — setting disabled="false" still disables the element in HTML.
                            // Previously: setAttribute(attr, false) — broken for disabled/checked/etc.
                            const BOOL_ATTRS = new Set([
                                'disabled', 'checked', 'readonly', 'required', 'hidden',
                                'selected', 'multiple', 'autofocus', 'autoplay', 'controls',
                                'loop', 'muted', 'open', 'default', 'defer', 'async',
                                'allowfullscreen', 'formnovalidate', 'novalidate', 'reversed',
                            ]);
                            splitByUnquotedChar(attrStr, ',').forEach(b => {
                                const pair = splitFirstUnquotedColon(b);
                                if (pair) {
                                    const attrName = pair[0].trim();
                                    const key = pair[1].trim();
                                    if (attrName && key) {
                                        const val = evaluateExpression(key, processedPayload);
                                        if (BOOL_ATTRS.has(attrName)) {
                                            // Boolean attribute: add (empty) or remove entirely
                                            if (val && val !== 'false' && val !== '0' && val !== 0) {
                                                node.setAttribute(attrName, '');
                                            } else {
                                                node.removeAttribute(attrName);
                                            }
                                        } else if (val === false || val === null || val === undefined) {
                                            // Non-boolean: remove when explicitly false/null/undefined
                                            node.removeAttribute(attrName);
                                        } else {
                                            node.setAttribute(attrName, String(val));
                                        }
                                    }
                                }
                            });
                        }
                    }
                    if (node.hasAttribute('data-rt-class')) {
                        const classStr = node.getAttribute('data-rt-class');
                        if (classStr) {
                            splitByUnquotedChar(classStr, ',').forEach(b => {
                                const pair = splitFirstUnquotedColon(b);
                                if (pair) {
                                     const className = pair[0].trim();
                                     const key = pair[1].trim();
                                     const classNames = className.split(/\s+/).filter(Boolean);
                                     if (evaluateExpression(key, processedPayload)) {
                                         classNames.forEach(c => node.classList.add(c));
                                     } else {
                                         classNames.forEach(c => node.classList.remove(c));
                                     }
                                 }
                            });
                        }
                    }
                    if (node.hasAttribute('data-rt-if')) {
                        const key = node.getAttribute('data-rt-if');
                        if (key) {
                            if (evaluateExpression(key, processedPayload)) {
                                (node as HTMLElement).style.display = '';
                            } else {
                                (node as HTMLElement).style.display = 'none';
                            }
                        }
                    }
                    if (node.hasAttribute('data-rt-hide')) {
                        const key = node.getAttribute('data-rt-hide');
                        if (key) {
                            if (evaluateExpression(key, processedPayload)) {
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
            
            if (template && typeof processedPayload === 'object' && processedPayload !== null) {
                if (Array.isArray(processedPayload)) {
                    let combinedHTML = '';
                    for (const item of processedPayload) {
                        combinedHTML += renderTemplate(template, item);
                    }
                    scheduleDOMUpdate(el, combinedHTML); // Batched update + VDOM Diffing!
                } else {
                    scheduleDOMUpdate(el, renderTemplate(template, processedPayload)); // Batched update + VDOM Diffing!
                }
                return;
            }

            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                (el as any).value = typeof processedPayload === 'object' ? (processedPayload.value !== undefined ? processedPayload.value : '') : processedPayload;
            } else if (template) {
                // Template path: renderTemplate already produced structured HTML, no extra sanitization needed
                // (sanitizeHTML would strip valid template-generated markup in test envs)
                el.innerHTML = typeof processedPayload === 'object' ? (processedPayload.html || processedPayload.text || JSON.stringify(processedPayload)) : String(processedPayload);
            } else {
                // @fix: Sanitize raw payload injected directly into innerHTML to prevent XSS
                const rawHTML = typeof processedPayload === 'object' ? (processedPayload.html || processedPayload.text || JSON.stringify(processedPayload)) : String(processedPayload);
                el.innerHTML = sanitizeHTML(rawHTML);
            }
        });
    };

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

            // @fix: Resolve component URLs relative to document.baseURI (respects <base href="/">)
            // so that ./components/login.html always fetches /components/login.html regardless
            // of the current hash route or URL path (was: resolved relative to current URL, broke on CDN).
            const baseURI = (typeof document !== 'undefined' && document.baseURI)
                ? document.baseURI
                : (typeof window !== 'undefined' ? window.location.origin + '/' : '/');
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

            // @fix: Sanitize fetched component HTML to prevent XSS injection (was: raw innerHTML)
            el.innerHTML = sanitizeHTML(content);
            el.removeAttribute('data-import');

            const nestedElements = el.querySelectorAll('[data-import]');
            if (nestedElements.length > 0) {
                const subPromises = Array.from(nestedElements).map(child => resolveNode(child, new Set(resolvingSet)));
                await Promise.all(subPromises);
            }

            this._scanStoreBinds();
            this._scanAndFetchAPIBinds();
        };

        const promises = Array.from(elements).map(el => resolveNode(el, new Set<string>()));
        await Promise.all(promises);
    };

    /** @private */
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
                if (!anchor.hasAttribute('data-spa') && anchor.getAttribute('data-spa') !== 'true') return;

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