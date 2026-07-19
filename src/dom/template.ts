/**
 * dom/template.ts — Svelte-style template compiler.
 * Supports: {#if}/{:else if}/{:else}/{/if}, {#each ... as item,index}/{/each},
 * double mustaches {{expr}}, optional chaining, dynamic attribute interpolation.
 */

import { evaluateExpression } from './helpers';

/** Render a Svelte-style template string with a given context object */
export function preprocessJSX(templateStr: string): string {
    let result = templateStr;

    // Helper to convert PascalCase (ShoppingCart) to kebab-case (shopping-cart)
    const kebabCase = (str: string) => str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

    const NATIVE_HTML_TAGS = new Set([
        'html', 'body', 'head', 'link', 'meta', 'style', 'title', 'address', 'article', 'aside', 'footer', 'header', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'main', 'nav', 'section', 'blockquote', 'dd', 'div', 'dl', 'dt', 'figcaption', 'figure', 'hr', 'li', 'ol', 'p', 'pre', 'ul', 'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'kbd', 'mark', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr', 'area', 'audio', 'img', 'map', 'track', 'video', 'embed', 'iframe', 'object', 'picture', 'portal', 'source', 'svg', 'math', 'canvas', 'noscript', 'script', 'del', 'ins', 'caption', 'col', 'colgroup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'button', 'datalist', 'fieldset', 'form', 'input', 'label', 'legend', 'meter', 'optgroup', 'option', 'select', 'textarea', 'details', 'dialog', 'menu', 'summary', 'template', 'g', 'path', 'rect', 'circle', 'line', 'polyline', 'polygon', 'ellipse', 'text', 'tspan', 'defs', 'use'
    ]);

    // Helper to convert a custom tag to icon spacer span
    const convertTag = (match: string, componentName: string, attrs: string) => {
        const lowerName = componentName.toLowerCase();
        if (NATIVE_HTML_TAGS.has(lowerName)) return match;
        const iconName = kebabCase(componentName);
        let cleanAttrs = attrs;
        let classVal = 'dolphin-icon-spacer';
        const classMatch = attrs.match(/\b(?:class|className)=(?:"([^"]*)"|'([^']*)'|{([^}]*)}|([^>\s]+))/);
        if (classMatch) {
            const extraClass = classMatch[1] || classMatch[2] || classMatch[3] || classMatch[4] || '';
            classVal += ' ' + extraClass;
            cleanAttrs = attrs.replace(/\b(?:class|className)=(?:"[^"]*"|'[^']*'|{[^}]*}|[^>\s]+)/, '');
        }
        return `<span class="${classVal}" data-icon-name="${iconName}" ${cleanAttrs.trim()}></span>`;
    };

    // 1. Unified JSX Ternary (handles tags, strings, numbers, nested HTML, etc.)
    //    {condition ? HTML_1 : HTML_2} → {#if condition}HTML_1{:else}HTML_2{/if}
    result = result.replace(/\{([^?{}]+)\?\s*([^:{}]+)\s*:\s*([^{}]+)\}/g, (match, condition, ifBranch, elseBranch) => {
        return `{#if ${condition.trim()}}${ifBranch.trim()}{:else}${elseBranch.trim()}{/if}`;
    });

    // 2. Unified JSX Logical-AND: {condition && HTML} → {#if condition}HTML{/if}
    result = result.replace(/\{([^&{}]+)&&\s*([^{}]+)\}/g, (match, condition, ifBranch) => {
        return `{#if ${condition.trim()}}${ifBranch.trim()}{/if}`;
    });

    // 3. NOW convert custom tags → dolphin-icon-spacer spans
    result = result.replace(/<([a-zA-Z0-9:-]+)\s*([^>]*?)(?:\/>|><\/\1>)/g, convertTag);

    // 4. Normalize React syntax (className → class, key → data-key, etc.)
    result = result
        .replace(/\bclassName=/g, 'class=')
        .replace(/\bonClick=/g, 'onclick=')
        .replace(/\bonChange=/g, 'onchange=')
        .replace(/\bonInput=/g, 'oninput=')
        .replace(/\bonKeyDown=/g, 'onkeydown=')
        .replace(/\bonKeyUp=/g, 'onkeyup=')
        .replace(/\bonSubmit=/g, 'onsubmit=')
        .replace(/\bkey=\{([\s\S]*?)\}/g, 'data-key="{{$1}}"')
        .replace(/\bkey="([\s\S]*?)"/g, 'data-key="$1"');

    // 5. Convert JSX style objects style={{ backdropFilter: 'blur(24px)' }} -> style="backdrop-filter: blur(24px);"
    result = result.replace(/\bstyle=\{\{([\s\S]*?)\}\}/g, (match, styleObjStr) => {
        const styleRules: string[] = [];
        const pairs = styleObjStr.split(',');
        pairs.forEach((pair: string) => {
            const colonIndex = pair.indexOf(':');
            if (colonIndex === -1) return;
            const prop = pair.substring(0, colonIndex).trim();
            let val = pair.substring(colonIndex + 1).trim();
            val = val.replace(/^(['"])(.*)\1$/, '$2'); // strip wrapping quotes
            const kebabProp = prop.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
            styleRules.push(`${kebabProp}: ${val};`);
        });
        return `style="${styleRules.join(' ')}"`;
    });

    return result;
}

/** Render a Svelte-style template string with a given context object */
export function renderTemplate(templateStr: string, context: any): string {
    const normalized = preprocessJSX(templateStr);

    // Fast-path: No block directives — simple mustache replacement
    if (!normalized.includes('{#if') && !normalized.includes('{#each')) {
        let result = normalized;
        for (let key in context) {
            const escapedKey = key.replace(/[.*+?^$${}()|[\]\\]/g, '\\$&');
            result = result.replace(
                new RegExp('\\{\\{' + escapedKey + '\\}\\}', 'g'),
                context[key] !== undefined && context[key] !== null ? context[key] : ''
            );
            // Also replace single mustaches in fast path
            result = result.replace(
                new RegExp('\\{' + escapedKey + '\\}', 'g'),
                context[key] !== undefined && context[key] !== null ? context[key] : ''
            );
        }
        // Resolve remaining nested paths: double curlies
        result = result.replace(/\{\{([\s\S]*?)\}\}/g, (match, expr) => {
            const trimmed = expr.trim();
            if (!trimmed) return '';
            if (/^[a-zA-Z_$][a-zA-Z0-9_$]*(?:(?:\??\.[a-zA-Z_$][a-zA-Z0-9_$]*))+$/.test(trimmed)) {
                const parts = trimmed.split(/\??\./).filter(Boolean);
                let val: any = context;
                for (const part of parts) {
                    if (val === undefined || val === null) { val = undefined; break; }
                    val = val[part];
                }
                return val !== undefined && val !== null ? val : '';
            }
            return match;
        });
        // Resolve remaining nested paths: single curlies
        result = result.replace(/\{([^{}]+?)\}/g, (match, expr) => {
            const trimmed = expr.trim();
            if (!trimmed) return '';
            if (trimmed.startsWith('#if') || trimmed.startsWith('#each') || trimmed.startsWith('/') || trimmed.startsWith(':else')) {
                return match;
            }
            const val = evaluateExpression(trimmed, context);
            return val !== undefined && val !== null ? val : '';
        });
        return result;
    }

    try {
        // Escape plain text for embedding in a double-quoted JS string
        const escapeString = (str: string): string => str
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');

        // Tokenized compiler — prevents backtick/`${` issues in templates
        let compiled = 'let out = "";\n';
        let lastIndex = 0;
        const regex = /(\{\{([\s\S]*?)\}\}|\{#if\s+([\s\S]*?)\}|\{:else\s+if\s+([\s\S]*?)\}|\{:else\}|\{\/if\}|\{#each\s+([\s\S]*?)\s+as\s+([a-zA-Z_$][a-zA-Z0-9_$]*)(?:\s*,\s*([a-zA-Z_$][a-zA-Z0-9_$]*))?\}|\{\/each\}|\{([^{}]+?)\})/g;
        const eachStack: { indexVar?: string }[] = [];

        let match;
        while ((match = regex.exec(normalized)) !== null) {
            const plainText = normalized.slice(lastIndex, match.index);
            if (plainText) compiled += `out += "${escapeString(plainText)}";\n`;

            const token = match[0];
            if (token.startsWith('{{')) {
                let expr = match[2];
                if (expr) {
                    while (/([a-zA-Z_$][a-zA-Z0-9_$]*)\.([a-zA-Z_$][a-zA-Z0-9_$]*)/.test(expr)) {
                        expr = expr.replace(/([a-zA-Z_$][a-zA-Z0-9_$]*)\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g, '$1?.$2');
                    }
                }
                compiled += `out += (${expr} !== undefined && ${expr} !== null ? ${expr} : "");\n`;
            } else if (token.startsWith('{#if')) {
                compiled += `if (${match[3]}) {\n`;
            } else if (token.startsWith('{:else if')) {
                compiled += `} else if (${match[4]}) {\n`;
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
                if (indexVar) compiled += `  let ${indexVar} = 0;\n`;
                compiled += `  for (let ${itemVar} of ${expr}) {\n`;
            } else if (token.startsWith('{/each}')) {
                const info = eachStack.pop();
                if (info && info.indexVar) compiled += `    ${info.indexVar}++;\n`;
                compiled += `  }\n}\n`;
            } else if (token.startsWith('{')) {
                const expr = match[8];
                if (expr) {
                    // Check if expression contains HTML elements (JSX-like)
                    if (expr.includes('<') && expr.includes('>')) {
                        // It's a JSX-like expression, handle it as template string
                        compiled += `out += (${expr} !== undefined && ${expr} !== null ? String(${expr}) : "");\n`;
                    } else {
                        // Regular expression
                        compiled += `out += (${expr} !== undefined && ${expr} !== null ? ${expr} : "");\n`;
                    }
                }
            }

            lastIndex = regex.lastIndex;
        }

        const remaining = normalized.slice(lastIndex);
        if (remaining) compiled += `out += "${escapeString(remaining)}";\n`;
        compiled += 'return out;\n';

        const fnBody = `with (context) { try { ${compiled} } catch (innerErr) { console.warn('[Dolphin Template Eval Warning]:', innerErr); return ''; } }`;
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
                    if (typeof globalThis !== 'undefined' && key in globalThis) return (globalThis as any)[key];
                    if (typeof window !== 'undefined' && key in window) return (window as any)[key];
                    return undefined;
                }
            });
        }
        const fn = new Function('context', fnBody);
        return fn(safeContext);
    } catch (e) {
        console.error('[Dolphin Template Compiler Error]:', e);
        let fallback = templateStr;
        for (let key in context) {
            const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            fallback = fallback.replace(
                new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g'),
                context[key] !== undefined && context[key] !== null ? context[key] : ''
            );
        }
        return fallback;
    }
}
