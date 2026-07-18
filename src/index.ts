import { DolphinClient } from './core';
import { attachDOMBinding, hydrateIcons } from './dom';
import { attachOffline } from './offline';
import { attachValidation } from './validation';
import { attachAnimations } from './animation';
import { attachA11y } from './a11y';
import { attachI18n } from './i18n';
import { attachDragDrop } from './dragdrop';
import { attachCollab } from './collab';
import { attachPwa } from './pwa';
import { attachTesting } from './testing';

attachDOMBinding(DolphinClient.prototype);
attachOffline(DolphinClient.prototype);
attachValidation(DolphinClient.prototype);
attachAnimations(DolphinClient.prototype);
attachA11y(DolphinClient.prototype);
attachI18n(DolphinClient.prototype);
attachDragDrop(DolphinClient.prototype);
attachCollab(DolphinClient.prototype);
attachPwa(DolphinClient.prototype);
attachTesting(DolphinClient.prototype);

// Standalone DOM helper functions
export const $ = (selector: string, parent: Document | HTMLElement = document): HTMLElement | null => {
  return parent.querySelector(selector);
};

export const $$ = (selector: string, parent: Document | HTMLElement = document): HTMLElement[] => {
  return Array.from(parent.querySelectorAll(selector));
};

export const on = (selector: string | HTMLElement, event: string, callback: EventListenerOrEventListenerObject): void => {
  const elements = typeof selector === 'string' ? $$(selector) : [selector];
  elements.forEach(el => el.addEventListener(event, callback));
};

export const dolphinElement = $;
export const dolphinQuery = on;
export { hydrateIcons };
export { renderTemplate, renderTemplate as compileTemplate, preprocessJSX } from './dom';

// Attach to DolphinClient prototype for class-level helper access
(DolphinClient.prototype as any).$ = $;
(DolphinClient.prototype as any).$$ = $$;
(DolphinClient.prototype as any).on = on;
(DolphinClient.prototype as any).dolphinElement = dolphinElement;
(DolphinClient.prototype as any).dolphinQuery = dolphinQuery;
(DolphinClient.prototype as any).hydrateIcons = hydrateIcons;

if (typeof window !== 'undefined') {
  (window as any).DolphinClient = DolphinClient;
  (window as any).hydrateIcons = hydrateIcons;
  
  // Safe global bindings to avoid conflicts
  if (!(window as any).$) (window as any).$ = $;
  if (!(window as any).$$) (window as any).$$ = $$;
  if (!(window as any).on) (window as any).on = on;
  
  (window as any).dolphinElement = dolphinElement;
  (window as any).dolphinQuery = dolphinQuery;
  
  // Auto-initialize a default client for zero-config plain HTML pages!
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      if (!(window as any).dolphin) {
        // Check if the script tag has data-debug="true"
        const scriptEl = document.querySelector('script[src*="dolphin-client"]');
        const debugMode = scriptEl ? scriptEl.getAttribute('data-debug') === 'true' : false;

        // Read router options from body data attributes
        const body = document.body;
        const routerMode = body ? body.getAttribute('data-router-mode') : null;
        const routerViewport = body ? body.getAttribute('data-router-viewport') : null;
        const routerTransitions = body ? body.getAttribute('data-router-transitions') : null;

        const options: any = { debug: debugMode, autoConnect: false };
        if (routerMode) options.routerMode = routerMode;
        if (routerViewport) options.routerViewport = routerViewport;
        if (routerTransitions) options.routerTransitions = routerTransitions === 'true';

        const dolphin = new DolphinClient(undefined, undefined, options);
        (window as any).dolphin = dolphin;

        if (debugMode) {
          console.log('%c🐬 [Dolphin Client] Auto-initialized local reactive engine!', 'color: #06b6d4; font-weight: bold; font-size: 14px;');
          console.log('%c👉 Tip: You can access the client instance via "window.dolphin" in console.', 'color: #94a3b8; font-style: italic;');
        }

        // Auto-seed default demo state if the demo input is present on the page
        if (document.querySelector('[data-store-write="app.username"]')) {
          (dolphin as any).setStoreState('app', 'username', 'नमस्ते साथी!');
        }
      }
    }, 0);
  });
}

export interface DolphinClientConfig {
  serverUrl?: string;
  roomId?: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  debug?: boolean;
  templateCache?: boolean;
  httpTimeout?: number;
  wsHeartbeat?: number;
}

export interface HTTPRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  payload?: any;
  bindTo?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retryCount?: number;
  _isRetry?: boolean;
}

export { DolphinClient };
