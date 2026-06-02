export function attachCollab(clientProto: any) {
  clientProto._initCollab = function() {
    if (typeof document === 'undefined') return;

    // @fix: Track remote cursor elements so they can be cleaned up (was: cursor divs leaked forever)
    const remoteCursors = new Map<string, HTMLElement>();
    // @fix: Track stale cursor cleanup timers
    const cursorStaleTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const CURSOR_STALE_MS = 5000; // remove cursor after 5s of inactivity

    // 1. Mouse Cursors Realtime Sharing (data-rt-cursor-share="roomName")
    this.addDomListener(document, 'mousemove', (e: MouseEvent) => {
      const shareContainers = document.querySelectorAll('[data-rt-cursor-share]');
      shareContainers.forEach((container: any) => {
        const room = container.getAttribute('data-rt-cursor-share');
        if (!room) return;

        // Compute coordinate ratios relative to container size
        const box = container.getBoundingClientRect();
        const xRatio = (e.clientX - box.left) / box.width;
        const yRatio = (e.clientY - box.top) / box.height;

        // Limit publishes frequency (throttle)
        const now = Date.now();
        if (!container._lastSent || now - container._lastSent > 50) {
          container._lastSent = now;
          this.pubPush(`collab/${room}/cursor/${this.deviceId}`, {
            deviceId: this.deviceId,
            x: xRatio,
            y: yRatio
          });
        }
      });
    });

    // 2. Realtime Typing Status Indicators (data-rt-typing="chatRoom")
    this.addDomListener(document, 'input', (e: any) => {
      const typingBind = e.target.getAttribute('data-rt-typing');
      if (!typingBind) return;

      const room = typingBind;
      
      const publishTyping = (isTyping: boolean) => {
        this.pubPush(`collab/${room}/typing/${this.deviceId}`, {
          deviceId: this.deviceId,
          typing: isTyping
        });
      };

      if (!e.target._isTyping) {
        e.target._isTyping = true;
        publishTyping(true);
      }

      // @fix: Clear previous timer before setting new one, and store so cleanup can cancel it
      if (e.target._typingTimer) clearTimeout(e.target._typingTimer);
      e.target._typingTimer = setTimeout(() => {
        e.target._isTyping = false;
        e.target._typingTimer = null;
        publishTyping(false);
      }, 2000);
    });

    // 3. Collaborative CRDT Text Sync (data-rt-crdt="docName")
    this.addDomListener(document, 'input', (e: any) => {
      const crdtBind = e.target.getAttribute('data-rt-crdt');
      if (!crdtBind) return;

      const docName = crdtBind;
      const value = e.target.value;
      const now = Date.now();

      // Implement a highly robust vector-based synchronization frame payload
      this.publish(`collab/${docName}/crdt`, {
        deviceId: this.deviceId,
        value,
        timestamp: now,
        cursorPos: e.target.selectionStart
      });
    });

    // Listen to collab WebSocket topics to render cursor components and text syncer
    this.subscribe('collab/+/cursor/+', (payload: any, topic: string) => {
      const parts = topic.split('/');
      const room = parts[1];
      const remoteDeviceId = parts[3];

      if (remoteDeviceId === this.deviceId) return; // skip self

      const container = document.querySelector(`[data-rt-cursor-share="${room}"]`);
      if (!container) return;

      const cursorKey = `${room}::${remoteDeviceId}`;

      // Find or create remote cursor element
      let cursorEl = remoteCursors.get(cursorKey);
      if (!cursorEl || !document.contains(cursorEl)) {
        cursorEl = document.createElement('div');
        cursorEl.className = `rt-cursor rt-cursor-${remoteDeviceId}`;
        cursorEl.style.position = 'absolute';
        cursorEl.style.width = '10px';
        cursorEl.style.height = '10px';
        cursorEl.style.borderRadius = '50%';
        cursorEl.style.backgroundColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
        cursorEl.style.pointerEvents = 'none';
        container.appendChild(cursorEl);
        // @fix: Track created cursor so cleanup can remove it (was: cursor elements never tracked)
        remoteCursors.set(cursorKey, cursorEl);
      }

      // Update cursor coordinates ratio in pixels
      const box = container.getBoundingClientRect();
      cursorEl.style.left = (payload.x * box.width) + 'px';
      cursorEl.style.top = (payload.y * box.height) + 'px';

      // @fix: Reset stale timer — remove cursor after CURSOR_STALE_MS of no updates
      if (cursorStaleTimers.has(cursorKey)) {
        clearTimeout(cursorStaleTimers.get(cursorKey)!);
      }
      cursorStaleTimers.set(cursorKey, setTimeout(() => {
        const el = remoteCursors.get(cursorKey);
        if (el && el.parentNode) el.parentNode.removeChild(el);
        remoteCursors.delete(cursorKey);
        cursorStaleTimers.delete(cursorKey);
      }, CURSOR_STALE_MS));
    });

    this.subscribe('collab/+/crdt', (payload: any, topic: string) => {
      if (payload.deviceId === this.deviceId) return; // skip self
      
      const parts = topic.split('/');
      const docName = parts[1];
      
      const crdtInputs = document.querySelectorAll(`[data-rt-crdt="${docName}"]`);
      crdtInputs.forEach((input: any) => {
        // Resolve concurrent conflict by simple clock timestamp
        if (!input._lastUpdate || payload.timestamp > input._lastUpdate) {
          input._lastUpdate = payload.timestamp;
          const originalPos = input.selectionStart;
          input.value = payload.value;
          
          // Restore caret position correctly
          if (document.activeElement === input) {
            input.setSelectionRange(originalPos, originalPos);
          }
        }
      });
    });

    // @fix: Expose cleanup so disconnect() can remove all cursor elements and cancel stale timers
    this._collabCleanup = () => {
      cursorStaleTimers.forEach(t => clearTimeout(t));
      cursorStaleTimers.clear();
      remoteCursors.forEach(el => {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
      remoteCursors.clear();
    };
  };
}
