export function attachA11y(clientProto: any) {
  clientProto._initA11y = function() {
    if (typeof document === 'undefined') return;

    // 1. Modal Focus Trap (data-rt-a11y-focus-trap)
    this.addDomListener(document, 'keydown', (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const trappedContainers = document.querySelectorAll('[data-rt-a11y-focus-trap]');
      
      trappedContainers.forEach((container: any) => {
        // Only trap if element is visible
        if (container.style.display === 'none' || container.hasAttribute('aria-hidden') && container.getAttribute('aria-hidden') === 'true') {
          return;
        }

        const focusableSelectors = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]';
        const focusableElements = Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
        if (focusableElements.length === 0) return;

        const firstEl = focusableElements[0];
        const lastEl = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            lastEl.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastEl) {
            firstEl.focus();
            e.preventDefault();
          }
        }
      });
    });

    // 2. Keyboard List Navigation (data-rt-keynav)
    this.addDomListener(document, 'keydown', (e: KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) return;
      
      const keyNavLists = document.querySelectorAll('[data-rt-keynav]');
      keyNavLists.forEach((list: any) => {
        const items = Array.from(list.children) as HTMLElement[];
        if (items.length === 0) return;

        let activeIdx = items.findIndex(el => el.classList.contains('active') || document.activeElement === el);
        
        if (e.key === 'ArrowDown') {
          activeIdx = (activeIdx + 1) % items.length;
          items[activeIdx].focus();
          items.forEach((item, idx) => {
            if (idx === activeIdx) item.classList.add('active');
            else item.classList.remove('active');
          });
          e.preventDefault();
        } else if (e.key === 'ArrowUp') {
          activeIdx = (activeIdx - 1 + items.length) % items.length;
          items[activeIdx].focus();
          items.forEach((item, idx) => {
            if (idx === activeIdx) item.classList.add('active');
            else item.classList.remove('active');
          });
          e.preventDefault();
        } else if (e.key === 'Enter' && activeIdx !== -1) {
          items[activeIdx].click();
          e.preventDefault();
        }
      });
    });
  };

  clientProto.autoAriaModal = function(modalEl: HTMLElement, isOpen: boolean) {
    if (isOpen) {
      modalEl.setAttribute('role', 'dialog');
      modalEl.setAttribute('aria-modal', 'true');
      modalEl.setAttribute('aria-hidden', 'false');
      modalEl.focus();
    } else {
      modalEl.setAttribute('aria-hidden', 'true');
    }
  };
}
