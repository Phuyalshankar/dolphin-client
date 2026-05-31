export function attachAnimations(clientProto: any) {
  clientProto.animateElement = function(el: HTMLElement, animationClass: string, durationMs: number = 300) {
    if (typeof el.animate !== 'function') {
      // Basic fallback if web animations API is missing
      el.classList.add(animationClass);
      setTimeout(() => el.classList.remove(animationClass), durationMs);
      return;
    }
    
    // Add modern staggered/fade effects based on class name
    if (animationClass === 'fade-in') {
      el.animate([
        { opacity: 0, transform: 'translateY(10px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], { duration: durationMs, easing: 'ease-out' });
    } else if (animationClass === 'fade-out') {
      el.animate([
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 0, transform: 'translateY(10px)' }
      ], { duration: durationMs, easing: 'ease-in' });
    }
  };

  clientProto.staggerListItems = function(container: HTMLElement, itemSelector: string, delayMs: number = 50) {
    if (typeof document === 'undefined') return;
    const items = container.querySelectorAll(itemSelector);
    items.forEach((item: any, idx: number) => {
      item.style.animationDelay = `${idx * delayMs}ms`;
      item.classList.add('staggered-item');
    });
  };
}
