import { DolphinClient } from './core';
import { attachDOMBinding } from './dom';
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

if (typeof window !== 'undefined') {
  (window as any).DolphinClient = DolphinClient;
  
  // Auto-initialize a default client for zero-config plain HTML pages!
  document.addEventListener('DOMContentLoaded', () => {
    if (!(window as any).dolphin) {
      const dolphin = new DolphinClient();
      (window as any).dolphin = dolphin;
      
      console.log('%c🐬 [Dolphin Client] Auto-initialized local reactive engine!', 'color: #06b6d4; font-weight: bold; font-size: 14px;');
      console.log('%c👉 Tip: You can access the client instance via "window.dolphin" in console.', 'color: #94a3b8; font-style: italic;');
      
      // Auto-seed default demo state if the demo input is present on the page
      if (document.querySelector('[data-store-write="app.username"]')) {
        (dolphin as any).setStoreState('app', 'username', 'नमस्ते साथी!');
      }
    }
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
