/**
 * dom/helpers.ts — Shared low-level DOM utilities used across all dom sub-modules.
 * Extracted from dom.ts to eliminate duplication and allow independent testing.
 */

// ── String Parsing Helpers ────────────────────────────────────────────────────

/** Escape special regex characters in a string */
export function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Split a string by an unquoted delimiter character.
 * Respects single quotes, double quotes, backticks, and bracket depth.
 */
export function splitByUnquotedChar(str: string, char: string): string[] {
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

/** Split a string at the first unquoted colon */
export function splitFirstUnquotedColon(str: string): [string, string] | null {
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

// ── Expression Evaluator ─────────────────────────────────────────────────────

/** Safely evaluate a JS expression with a context object (uses Proxy + with) */
export function getNestedValue(obj: any, path: string): any {
    if (!obj || typeof obj !== 'object' || !path) return undefined;
    if (Object.prototype.hasOwnProperty.call(obj, path)) return obj[path];
    const parts = String(path).replace(/\?/g, '').split('.');
    let current = obj;
    for (let i = 0; i < parts.length; i++) {
        if (current === undefined || current === null) return undefined;
        current = current[parts[i]];
    }
    return current;
}

export function evaluateExpression(expr: string, ctx: any): any {
    if (!ctx || typeof ctx !== 'object' || !expr) return undefined;
    const trimmed = String(expr).trim();
    const directVal = getNestedValue(ctx, trimmed);
    if (directVal !== undefined) return directVal;
    try {
        const fn = new Function('ctx', `try { with(ctx) { return (${trimmed}); } } catch(e) { return undefined; }`);
        return fn(ctx);
    } catch {
        return directVal;
    }
}

// ── XSS Sanitizer ────────────────────────────────────────────────────────────

/** Zero-dependency browser HTML sanitizer — strips script/iframe/on* etc. */
export function sanitizeHTML(html: string): string {
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
        return html;
    }
}

/** Forces browser to execute script tags injected via innerHTML */
export function executeScripts(container: Element) {
    if (typeof document === 'undefined') return;
    const scripts = container.querySelectorAll('script');
    scripts.forEach((oldScript) => {
        const newScript = document.createElement('script');
        if (oldScript.attributes) {
            Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
        }
        newScript.textContent = oldScript.textContent;
        oldScript.parentNode?.replaceChild(newScript, oldScript);
    });
}

// ── DOM Reconciliation (Virtual DOM Diffing) ─────────────────────────────────

/** Recursively diff two DOM nodes and apply minimal patches */
export function diffDOM(existingNode: Node, newNode: Node) {
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
        const maxLen = Math.max(childs1.length, childs2.length);
        for (let i = 0; i < maxLen; i++) {
            if (i >= childs1.length) {
                el1.appendChild(childs2[i].cloneNode(true));
            } else if (i >= childs2.length) {
                el1.removeChild(childs1[i]);
            } else {
                diffDOM(childs1[i], childs2[i]);
            }
        }
    }
}

/** Apply new HTML to a parent element using diffDOM for minimal repaints */
export function patchDOM(parentElement: Element, newHTML: string) {
    if (typeof document === 'undefined') return;
    const temp = document.createElement(parentElement.tagName);
    temp.innerHTML = newHTML;

    const filterNodes = (nList: NodeList) => 
        Array.from(nList).filter(node => node.nodeType !== 3 || (node.textContent && node.textContent.trim() !== ''));

    const childs1 = filterNodes(parentElement.childNodes);
    const childs2 = filterNodes(temp.childNodes);
    const maxLen = Math.max(childs1.length, childs2.length);
    for (let i = 0; i < maxLen; i++) {
        if (i >= childs1.length) {
            parentElement.appendChild(childs2[i].cloneNode(true));
        } else if (i >= childs2.length) {
            parentElement.removeChild(childs1[i]);
        } else {
            diffDOM(childs1[i], childs2[i]);
        }
    }
}

// ── RAF-Batched DOM Update Scheduler ─────────────────────────────────────────

// @fix: Map cleared every RAF cycle — disconnected elements skipped and never retained
const pendingUpdates = new Map<Element, string>();
let rafScheduled = false;

/** Schedule a batched DOM update using requestAnimationFrame */
export function scheduleDOMUpdate(element: Element, newHTML: string) {
    // @fix: Early guard — skip elements already detached from DOM to prevent stale references
    if (typeof element.isConnected === 'boolean' && !element.isConnected) return;
    pendingUpdates.set(element, newHTML);
    if (!rafScheduled) {
        rafScheduled = true;
        const scheduleFn = typeof requestAnimationFrame !== 'undefined'
            ? requestAnimationFrame
            : (cb: () => void) => setTimeout(cb, 0);
        scheduleFn(() => {
            pendingUpdates.forEach((html, el) => {
                if ((el as any).isConnected !== false) {
                    if (typeof el.hasAttribute === 'function' && el.hasAttribute('data-rt-template')) {
                        el.innerHTML = html;
                    } else {
                        patchDOM(el, html);
                    }
                }
            });
            pendingUpdates.clear();
            rafScheduled = false;
            hydrateIcons();
        });
    }
}

// ── Template Resolver ─────────────────────────────────────────────────────────

/** Resolve data-rt-template as raw HTML or a CSS selector pointing to a <template> node */
export function resolveTemplate(el: Element): string | null {
    const template = el.getAttribute('data-rt-template');
    if (!template) return null;
    if (typeof document !== 'undefined' && !template.includes('<')) {
        try {
            const parentScope = (el as any).closest ? (el as any).closest('main, [data-import], section, body') || el.parentNode : el.parentNode;
            const scopedTemp = parentScope && typeof parentScope.querySelector === 'function' ? parentScope.querySelector(template) : null;
            if (scopedTemp) return scopedTemp.innerHTML;
            const tempEl = document.querySelector(template);
            if (tempEl) return tempEl.innerHTML;
        } catch {}
    }
    return template;
}

/** Asynchronously hydrates any Lucide icon spacers in the DOM, with localStorage caching */
export function hydrateIcons(container: Element | Document = document) {
    if (typeof document === 'undefined') return;
    const spacers = container.querySelectorAll('.dolphin-icon-spacer');
    if (spacers.length === 0) return;

    spacers.forEach(async (span) => {
        const iconName = span.getAttribute('data-icon-name');
        if (!iconName || iconName.startsWith('dolphin-')) return;
        const classes = (span.getAttribute('class') || '').replace('dolphin-icon-spacer', '').trim();
        const cacheKey = `dolphin-icon-${iconName}`;

        const injectClasses = (svgStr: string) => {
            if (classes) {
                if (svgStr.includes('class=')) {
                    return svgStr.replace(/class="([^"]*)"/, `class="$1 ${classes}"`);
                }
                return svgStr.replace('<svg', `<svg class="${classes}"`);
            }
            return svgStr;
        };

        // 1. Try local storage cache
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                span.outerHTML = injectClasses(cached);
                return;
            }
        } catch {}

        // 2. Fetch from CDN
        try {
            const res = await fetch(`https://unpkg.com/lucide-static/icons/${iconName}.svg`);
            if (res.ok) {
                const rawSVG = await res.text();
                try {
                    localStorage.setItem(cacheKey, rawSVG);
                } catch {}
                span.outerHTML = injectClasses(rawSVG);
            }
        } catch (err) {
            console.warn(`[Dolphin Lucide Hydration Warning]: Failed to fetch icon "${iconName}":`, err);
        }
    });
}
