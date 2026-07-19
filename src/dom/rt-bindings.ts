/**
 * dom/rt-bindings.ts — Realtime DOM bindings: _updateDOM, _applyDeclarativeDirectives.
 * Handles data-rt-bind, data-rt-template, data-rt-text, data-rt-html,
 * data-rt-attr, data-rt-class, data-rt-if, data-rt-hide context rendering.
 */

import {
    evaluateExpression,
    sanitizeHTML,
    scheduleDOMUpdate,
    resolveTemplate,
    splitByUnquotedChar,
    splitFirstUnquotedColon,
} from './helpers';
import { renderTemplate } from './template';

export function attachRTBindings(clientProto: any) {

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
                                    const resolveVal = (obj: any, path: string) =>
                                        path.split('.').reduce((acc: any, part: string) => acc && acc[part], obj);
                                    let valA = resolveVal(a, field) ?? a[field];
                                    let valB = resolveVal(b, field) ?? b[field];
                                    if (typeof valA === 'string' && typeof valB === 'string') {
                                        return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                                    }
                                    const numA = Number(valA), numB = Number(valB);
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
                    if (Array.isArray(payload[key])) { foundArrayKey = key; break; }
                }
                if (foundArrayKey) {
                    processedPayload = { ...payload, [foundArrayKey]: applyFilterSearchSort(payload[foundArrayKey]) };
                }
            }
        }
        return processedPayload;
    };

    clientProto._updateDOM = function(topic: string, payload: any) {
        if (typeof document === 'undefined') return;
        const elements = document.querySelectorAll(`[data-rt-bind="${topic}"]`);
        elements.forEach(el => {
            const processedPayload = this._applyDeclarativeDirectives(el, payload);
            (el as any)._rtContext = processedPayload;

            // Context mode — propagate data to child nodes via data-rt-text, data-rt-html etc. (skip if data-rt-template is specified)
            if (el.getAttribute('data-rt-type') === 'context' && !el.hasAttribute('data-rt-template') && typeof processedPayload === 'object' && processedPayload !== null) {

                const BOOL_ATTRS = new Set([
                    'disabled','checked','readonly','required','hidden','selected','multiple',
                    'autofocus','autoplay','controls','loop','muted','open','default','defer',
                    'async','allowfullscreen','formnovalidate','novalidate','reversed',
                ]);

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
                            if (val !== undefined && val !== null) node.innerHTML = sanitizeHTML(val);
                        }
                    }
                    if (node.hasAttribute('data-rt-attr')) {
                        const attrStr = node.getAttribute('data-rt-attr');
                        if (attrStr) {
                            splitByUnquotedChar(attrStr, ',').forEach(b => {
                                const pair = splitFirstUnquotedColon(b);
                                if (pair) {
                                    const attrName = pair[0].trim();
                                    const key = pair[1].trim();
                                    if (attrName && key) {
                                        const val = evaluateExpression(key, processedPayload);
                                        if (BOOL_ATTRS.has(attrName)) {
                                            if (val && val !== 'false' && val !== '0' && val !== 0) node.setAttribute(attrName, '');
                                            else node.removeAttribute(attrName);
                                        } else if (val === false || val === null || val === undefined) {
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
                                    if (evaluateExpression(key, processedPayload)) classNames.forEach(c => node.classList.add(c));
                                    else classNames.forEach(c => node.classList.remove(c));
                                }
                            });
                        }
                    }
                    if (node.hasAttribute('data-rt-if')) {
                        const key = node.getAttribute('data-rt-if');
                        if (key) {
                            (node as HTMLElement).style.display = evaluateExpression(key, processedPayload) ? '' : 'none';
                        }
                    }
                    if (node.hasAttribute('data-rt-hide')) {
                        const key = node.getAttribute('data-rt-hide');
                        if (key) {
                            (node as HTMLElement).style.display = evaluateExpression(key, processedPayload) ? 'none' : '';
                        }
                    }
                };
                processNode(el);
                el.querySelectorAll('[data-rt-text],[data-rt-html],[data-rt-attr],[data-rt-class],[data-rt-if],[data-rt-hide]').forEach(processNode);
                return;
            }

            const template = resolveTemplate(el);

            if (template && typeof processedPayload === 'object' && processedPayload !== null) {


                let arrayToRender = null;
                if (Array.isArray(processedPayload)) {
                    arrayToRender = processedPayload;
                } else if (!template.includes('{#each')) {
                    for (const key in processedPayload) {
                        if (Array.isArray(processedPayload[key])) {
                            arrayToRender = processedPayload[key];
                            break;
                        }
                    }
                }

                if (arrayToRender) {
                    if (this.options?.debug) {
                        console.log(`%c🐬 [Dolphin Render Debug]: Topic "${topic}" rendering ${arrayToRender.length} items to template "${el.getAttribute('data-rt-template')}"`, 'color: #a855f7; font-weight: bold;', arrayToRender);
                    }
                    if (el.getAttribute('data-rt-virtual') === 'true') {
                        if (!(el as any)._virtualListenerWired) {
                            (el as any)._virtualListenerWired = true;
                            el.addEventListener('scroll', () => {
                                this._updateDOM(topic, payload);
                            });
                            const computedStyle = window.getComputedStyle(el);
                            if (computedStyle.overflowY === 'visible' || computedStyle.overflow === 'visible') {
                                (el as HTMLElement).style.overflowY = 'auto';
                                if (computedStyle.position === 'static') {
                                    (el as HTMLElement).style.position = 'relative';
                                }
                            }
                        }

                        const itemHeight = Number(el.getAttribute('data-rt-item-height')) || 150;
                        const buffer = Number(el.getAttribute('data-rt-buffer')) || 5;
                        const scrollTop = el.scrollTop || 0;
                        const containerHeight = el.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 0) || 768;

                        const totalCount = arrayToRender.length;
                        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
                        const endIndex = Math.min(totalCount, Math.ceil((scrollTop + containerHeight) / itemHeight) + buffer);

                        const topHeight = startIndex * itemHeight;
                        const bottomHeight = Math.max(0, (totalCount - endIndex) * itemHeight);

                        let combinedHTML = `<div class="rt-virtual-spacer-top" style="height: ${topHeight}px; width: 100%; pointer-events: none;"></div>`;
                        for (let i = startIndex; i < endIndex; i++) {
                            combinedHTML += renderTemplate(template, arrayToRender[i]);
                        }
                        combinedHTML += `<div class="rt-virtual-spacer-bottom" style="height: ${bottomHeight}px; width: 100%; pointer-events: none;"></div>`;
                        scheduleDOMUpdate(el, combinedHTML);
                    } else {
                        let combinedHTML = '';
                        for (const item of arrayToRender) {
                            combinedHTML += renderTemplate(template, item);
                        }
                        scheduleDOMUpdate(el, combinedHTML);
                    }
                } else {
                    scheduleDOMUpdate(el, renderTemplate(template, processedPayload));
                }
                return;
            }

            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                (el as any).value = typeof processedPayload === 'object'
                    ? (processedPayload.value !== undefined ? processedPayload.value : '')
                    : processedPayload;
            } else if (template) {
                el.innerHTML = typeof processedPayload === 'object'
                    ? (processedPayload.html || processedPayload.text || JSON.stringify(processedPayload))
                    : String(processedPayload);
            } else {
                const rawHTML = typeof processedPayload === 'object'
                    ? (processedPayload.html || processedPayload.text || JSON.stringify(processedPayload))
                    : String(processedPayload);
                el.innerHTML = sanitizeHTML(rawHTML);
            }
        });
    };
}
