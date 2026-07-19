/** dom/module-bindings.ts — Declarative local ES module data bindings. */

/**
 * Loads arrays or objects exported by local ES modules and renders them through
 * the same binding pipeline used by API responses. Example:
 *
 * <div data-module-get="./js/menu.js" data-rt-bind="menu"></div>
 *
 * The scanner uses `data-module-export` when present; otherwise it uses the
 * `data-rt-bind` value as the named export and falls back to `default`.
 */
export function attachModuleBindings(clientProto: any) {
    clientProto._scanAndLoadModuleBinds = async function() {
        if (typeof document === 'undefined') return;

        const elements = document.querySelectorAll('[data-module-get]');
        for (const el of Array.from(elements) as Element[]) {
            // Type guard: ensure el is an Element with required methods
            if (!el || typeof el.getAttribute !== 'function' || typeof el.hasAttribute !== 'function') continue;
            
            const src = el.getAttribute('data-module-get');
            const topic = el.getAttribute('data-rt-bind');
            if (!src || !topic || el.hasAttribute('data-module-initialized')) continue;

            el.setAttribute('data-module-initialized', 'true');

            try {
                const baseUrl = typeof window !== 'undefined' ? window.location.href : undefined;
                const moduleUrl = baseUrl ? new URL(src, baseUrl).href : src;
                const moduleData = await import(/* @vite-ignore */ moduleUrl);
                const exportName = el.getAttribute('data-module-export') || topic;
                const payload = moduleData[exportName] ?? moduleData.default;

                if (payload === undefined) {
                    throw new Error(`Export "${exportName}" was not found.`);
                }

                this._updateDOM(topic, payload);
            } catch (error) {
                if (this.options?.debug) {
                    console.error(`[Dolphin] Module data load failed for "${src}":`, error);
                }
            }
        }
    };
}
