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
  // window.dolphin auto-creation removed — user must create their own instance with the correct server URL
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
