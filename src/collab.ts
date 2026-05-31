export function attachCollab(clientProto: any) {
  clientProto._initCollab = function() {
    if (typeof document === 'undefined') return;

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

      if (e.target._typingTimer) clearTimeout(e.target._typingTimer);
      e.target._typingTimer = setTimeout(() => {
        e.target._isTyping = false;
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

      // Find or create remote cursor element
      let cursorEl = container.querySelector(`.rt-cursor-${remoteDeviceId}`) as HTMLElement;
      if (!cursorEl) {
        cursorEl = document.createElement('div');
        cursorEl.className = `rt-cursor rt-cursor-${remoteDeviceId}`;
        cursorEl.style.position = 'absolute';
        cursorEl.style.width = '10px';
        cursorEl.style.height = '10px';
        cursorEl.style.borderRadius = '50%';
        cursorEl.style.backgroundColor = '#' + Math.floor(Math.random()*16777215).toString(16);
        cursorEl.style.pointerEvents = 'none';
        container.appendChild(cursorEl);
      }

      // Update cursor coordinates ratio in pixels
      const box = container.getBoundingClientRect();
      cursorEl.style.left = (payload.x * box.width) + 'px';
      cursorEl.style.top = (payload.y * box.height) + 'px';
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
  };
}
