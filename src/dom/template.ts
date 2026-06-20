/**
 * dom/template.ts — Svelte-style template compiler.
 * Supports: {#if}/{:else if}/{:else}/{/if}, {#each ... as item,index}/{/each},
 * double mustaches {{expr}}, optional chaining, dynamic attribute interpolation.
 */

import { evaluateExpression } from './helpers';

/** Render a Svelte-style template string with a given context object */
export function renderTemplate(templateStr: string, context: any): string {
    // Fast-path: No block directives — simple mustache replacement
    if (!templateStr.includes('{#if') && !templateStr.includes('{#each')) {
        let result = templateStr;
        for (let key in context) {
            const escapedKey = key.replace(/[.*+?^$${}()|[\]\\]/g, '\\$&');
            result = result.replace(
                new RegExp('\\{\\{' + escapedKey + '\\}\\}', 'g'),
                context[key] !== undefined && context[key] !== null ? context[key] : ''
            );
        }
        // Resolve remaining nested paths: dot notation (rating.rate) and optional chaining (rating?.rate)
        result = result.replace(/\{\{([\s\S]*?)\}\}/g, (match, expr) => {
            const trimmed = expr.trim();
            if (!trimmed) return '';
            // Support both: rating.rate  AND  rating?.rate  AND  a?.b?.c
            if (/^[a-zA-Z_$][a-zA-Z0-9_$]*(?:(?:\??\.[a-zA-Z_$][a-zA-Z0-9_$]*))+$/.test(trimmed)) {
                // Normalize: convert ?. to . for traversal
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
        while ((match = regex.exec(templateStr)) !== null) {
            const plainText = templateStr.slice(lastIndex, match.index);
            if (plainText) compiled += `out += "${escapeString(plainText)}";\n`;

            const token = match[0];
            if (token.startsWith('{{')) {
                const expr = match[2];
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
                if (expr) compiled += `out += (${expr} !== undefined && ${expr} !== null ? ${expr} : "");\n`;
            }

            lastIndex = regex.lastIndex;
        }

        const remaining = templateStr.slice(lastIndex);
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
