export function attachPwa(clientProto: any) {
  clientProto.registerServiceWorker = async function(swPath: string = '/sw.js') {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      console.warn('[Dolphin PWA] Service Workers are not supported in this browser.');
      return null;
    }
    try {
      const registration = await navigator.serviceWorker.register(swPath);
      console.log('[Dolphin PWA] Service Worker registered successfully with scope:', registration.scope);
      return registration;
    } catch (e) {
      console.error('[Dolphin PWA] Service Worker registration failed:', e);
      return null;
    }
  };

  clientProto.subscribePushNotifications = async function(vapidPublicKey: string) {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[Dolphin PWA] Push notifications are not supported in this browser.');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Convert VAPID public key from url-safe base64 to uint8array
        const padding = '='.repeat((4 - (vapidPublicKey.length % 4)) % 4);
        const base64 = (vapidPublicKey + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: outputArray
        });
      }
      
      console.log('[Dolphin PWA] Subscribed to push notifications:', subscription);
      return subscription;
    } catch (e) {
      console.error('[Dolphin PWA] Push notification subscription failed:', e);
      return null;
    }
  };
}
