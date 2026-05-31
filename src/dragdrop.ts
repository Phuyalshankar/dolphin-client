export function attachDragDrop(clientProto: any) {
  clientProto._initDragDrop = function() {
    if (typeof document === 'undefined') return;

    // 1. Declarative Draggable Elements (data-drag)
    this.addDomListener(document, 'dragstart', (e: any) => {
      const dragEl = e.target.closest('[data-drag]');
      if (!dragEl) return;

      const payloadStr = dragEl.getAttribute('data-drag');
      if (payloadStr) {
        e.dataTransfer.setData('text/plain', payloadStr);
        e.dataTransfer.effectAllowed = 'move';
        dragEl.classList.add('dragging');
      }
    });

    this.addDomListener(document, 'dragend', (e: any) => {
      const dragEl = e.target.closest('[data-drag]');
      if (dragEl) {
        dragEl.classList.remove('dragging');
      }
    });

    // 2. Declarative Drop Zones (data-drop)
    this.addDomListener(document, 'dragover', (e: any) => {
      const dropZone = e.target.closest('[data-drop]');
      if (dropZone) {
        e.preventDefault(); // Required to allow dropping!
        dropZone.classList.add('drag-over');
      }
    });

    this.addDomListener(document, 'dragleave', (e: any) => {
      const dropZone = e.target.closest('[data-drop]');
      if (dropZone) {
        dropZone.classList.remove('drag-over');
      }
    });

    this.addDomListener(document, 'drop', (e: any) => {
      const dropZone = e.target.closest('[data-drop]');
      if (!dropZone) return;

      e.preventDefault();
      dropZone.classList.remove('drag-over');

      const topic = dropZone.getAttribute('data-drop');
      const dataStr = e.dataTransfer.getData('text/plain');

      if (topic && dataStr) {
        try {
          const payload = JSON.parse(dataStr);
          this.publish(topic, payload);
        } catch {
          // plain string fallback
          this.publish(topic, { value: dataStr });
        }
      }
    });

    // 3. Declarative Sortable Lists (data-sortable)
    this.addDomListener(document, 'dragover', (e: any) => {
      const sortableContainer = e.target.closest('[data-sortable]');
      if (!sortableContainer) return;

      e.preventDefault();
      const draggingEl = sortableContainer.querySelector('.dragging');
      if (!draggingEl) return;

      // Find the sibling element where draggingEl should go after/before
      const siblings = Array.from(sortableContainer.querySelectorAll('[data-drag]:not(.dragging)')) as HTMLElement[];
      
      const nextSibling = siblings.find(sibling => {
        const box = sibling.getBoundingClientRect();
        const offset = e.clientY - box.top - box.height / 2;
        return offset < 0;
      });

      if (nextSibling) {
        sortableContainer.insertBefore(draggingEl, nextSibling);
      } else {
        sortableContainer.appendChild(draggingEl);
      }
    });

    this.addDomListener(document, 'drop', (e: any) => {
      const sortableContainer = e.target.closest('[data-sortable]');
      if (!sortableContainer) return;

      const topic = sortableContainer.getAttribute('data-sortable');
      if (!topic) return;

      // Collect the new order of child elements' data payloads
      const elements = Array.from(sortableContainer.querySelectorAll('[data-drag]')) as HTMLElement[];
      const newOrder = elements.map((el, index) => {
        const payloadStr = el.getAttribute('data-drag');
        try {
          return { index, payload: JSON.parse(payloadStr || '{}') };
        } catch {
          return { index, payload: payloadStr };
        }
      });

      this.publish(topic, newOrder);
    });
  };
}
