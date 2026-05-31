export {};
const { DolphinClient } = require('../src/index');
const { DolphinTestUtils } = require('../src/testing');

class MockElement {
  tagName: string;
  nodeType: number;
  childNodes: MockElement[];
  attributes: { name: string; value: string }[];
  style: any;
  classList: {
    add: jest.Mock;
    remove: jest.Mock;
    contains: jest.Mock;
  };
  parentNode: MockElement | null;
  _textContent: string;
  name: string;
  value: string;
  checked: boolean;
  type: string;

  constructor(tagName: string, nodeType: number = 1) {
    this.tagName = tagName.toUpperCase();
    this.nodeType = nodeType;
    this.childNodes = [];
    this.attributes = [];
    this.style = {};
    this.classList = {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn().mockReturnValue(false)
    };
    this.parentNode = null;
    this._textContent = '';
    this.name = '';
    this.value = '';
    this.checked = false;
    this.type = '';
  }

  get children() {
    return this.childNodes.filter(c => c.nodeType === 1);
  }

  get innerHTML() {
    if (this.nodeType === 3) return '';
    return this.childNodes.map(c => {
      if (c.nodeType === 3) return c.textContent;
      return c.outerHTML;
    }).join('');
  }

  set innerHTML(val: string) {
    this.childNodes = [];
    const txt = new MockElement('#text', 3);
    txt._textContent = val;
    this.appendChild(txt);
  }

  get textContent() {
    if (this.nodeType === 3) return this._textContent;
    return this.childNodes.map(c => c.textContent).join('');
  }

  set textContent(val: string) {
    if (this.nodeType === 3) {
      this._textContent = val;
    } else {
      const txt = new MockElement('#text', 3);
      txt._textContent = val;
      this.childNodes = [txt];
    }
  }

  get outerHTML() {
    if (this.nodeType === 3) return this.textContent;
    const attrs = this.attributes.map(a => `${a.name}="${a.value}"`).join(' ');
    const attrStr = attrs ? ' ' + attrs : '';
    return `<${this.tagName.toLowerCase()}${attrStr}>${this.innerHTML}</${this.tagName.toLowerCase()}>`;
  }

  getAttribute(name: string) {
    const attr = this.attributes.find(a => a.name === name);
    return attr ? attr.value : null;
  }

  setAttribute(name: string, value: string) {
    const attr = this.attributes.find(a => a.name === name);
    if (attr) {
      attr.value = value;
    } else {
      this.attributes.push({ name, value });
    }
  }

  removeAttribute(name: string) {
    this.attributes = this.attributes.filter(a => a.name !== name);
  }

  hasAttribute(name: string) {
    return this.attributes.some(a => a.name === name);
  }

  appendChild(child: MockElement) {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  removeChild(child: MockElement) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  cloneNode(deep: boolean = true) {
    const clone = new MockElement(this.tagName, this.nodeType);
    clone._textContent = this._textContent;
    clone.name = this.name;
    clone.value = this.value;
    clone.checked = this.checked;
    clone.type = this.type;
    this.attributes.forEach(a => clone.setAttribute(a.name, a.value));
    if (deep) {
      this.childNodes.forEach(c => clone.appendChild(c.cloneNode(true)));
    }
    return clone;
  }

  closest(selector: string): MockElement | null {
    let current: MockElement | null = this;
    while (current) {
      if (selector.startsWith('[') && selector.endsWith(']')) {
        const attr = selector.slice(1, -1);
        if (current.hasAttribute(attr)) return current;
      } else {
        if (current.tagName === selector.toUpperCase()) return current;
      }
      current = current.parentNode;
    }
    return null;
  }

  querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    const traverse = (node: MockElement) => {
      node.childNodes.forEach(child => {
        if (selector === '[data-i18n-key]' && child.hasAttribute('data-i18n-key')) results.push(child);
        else if (selector === '[data-i18n-dict]' && child.hasAttribute('data-i18n-dict')) results.push(child);
        traverse(child);
      });
    };
    traverse(this);
    return results;
  }
}

describe('v2.0 Advanced Integrated Capabilities', () => {
  let c: any;
  let docElements: MockElement[];

  beforeEach(() => {
    docElements = [];
    if (typeof (global as any).Node === 'undefined') {
      (global as any).Node = {
        ELEMENT_NODE: 1,
        TEXT_NODE: 3
      } as any;
    }
    (global as any).document = {
      querySelectorAll: jest.fn().mockImplementation((sel) => {
        if (sel === '[data-i18n-key]') return docElements.filter(e => e.hasAttribute('data-i18n-key'));
        if (sel === '[data-i18n-dict]') return docElements.filter(e => e.hasAttribute('data-i18n-dict'));
        return [];
      }),
      addEventListener: jest.fn(),
      createElement: jest.fn().mockImplementation((tag) => new MockElement(tag))
    };
    (global as any).requestAnimationFrame = (cb: () => void) => cb();
    c = new DolphinClient('http://localhost:3000');
  });

  afterEach(() => {
    delete (global as any).document;
    delete (global as any).requestAnimationFrame;
  });

  // --- 1. Animations (Phase 4) ---

  test('animateElement adds fallback class transitions', () => {
    const el = new MockElement('DIV') as any;
    c.animateElement(el, 'shake-effect', 100);
    expect(el.classList.add).toHaveBeenCalledWith('shake-effect');
  });

  // --- 2. Accessibility (Phase 4) ---

  test('autoAriaModal updates accessibility roles and focus states', () => {
    const el = new MockElement('DIV') as any;
    el.focus = jest.fn();

    c.autoAriaModal(el, true);
    expect(el.getAttribute('role')).toBe('dialog');
    expect(el.getAttribute('aria-modal')).toBe('true');
    expect(el.getAttribute('aria-hidden')).toBe('false');
    expect(el.focus).toHaveBeenCalled();

    c.autoAriaModal(el, false);
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  // --- 3. Internationalization (Phase 4) ---

  test('translateDOM dynamically translates dictionary keys and interpolates param variables', () => {
    const el = new MockElement('SPAN');
    el.setAttribute('data-i18n-key', 'welcome');
    el.setAttribute('data-i18n-params', '{"name": "Ram"}');
    docElements.push(el);

    c.i18n = {
      locale: 'en',
      dicts: {
        en: {
          welcome: 'Hello {{name}}! Welcome to Dolphin.'
        }
      }
    };

    c.translateDOM();

    expect(el.textContent).toBe('Hello Ram! Welcome to Dolphin.');
  });

  // --- 4. Drag & Drop (Phase 5) ---

  test('dragstart registers dataTransfer values', () => {
    const addEventListenerMock = (global as any).document.addEventListener;
    let dragStartHandler: any = null;

    addEventListenerMock.mockImplementation((event: string, handler: any) => {
      if (event === 'dragstart') dragStartHandler = handler;
    });

    c._initDragDrop();

    const dragEl = new MockElement('DIV');
    dragEl.setAttribute('data-drag', '{"id": 99}');

    const eventMock = {
      target: dragEl,
      dataTransfer: {
        setData: jest.fn(),
        effectAllowed: ''
      }
    };

    dragStartHandler(eventMock);

    expect(eventMock.dataTransfer.setData).toHaveBeenCalledWith('text/plain', '{"id": 99}');
    expect(dragEl.classList.add).toHaveBeenCalledWith('dragging');
  });

  // --- 5. Standalone Testing Utilities (Phase 6) ---

  test('DolphinTestUtils mocks standard WebSockets cleanly', () => {
    const mockWS = DolphinTestUtils.mockWebSocket();
    expect(mockWS).toBeDefined();
    expect(mockWS.readyState).toBe(1);

    const wsInstance = new (global as any).WebSocket('ws://localhost:3000');
    wsInstance.send('{"hello": "world"}');

    expect(mockWS.sentMessages).toContain('{"hello": "world"}');
  });

  // --- 6. Production Hardening & Memory Leak Resolution (Phase 7) ---

  test('disconnect clears all global DOM event listeners cleanly', () => {
    c._initDOMBinding();
    c._initA11y();
    c._initDragDrop();
    c._initCollab();

    // Verify listeners are tracked
    expect(c._attachedListeners.length).toBeGreaterThan(0);

    const removeEventListenerSpy = jest.fn();
    (global as any).document.removeEventListener = removeEventListenerSpy;

    c.disconnect();

    // Verify listeners are removed and array is cleared
    expect(removeEventListenerSpy).toHaveBeenCalled();
    expect(c._attachedListeners.length).toBe(0);
  });

  test('RegExp template replaces survive special character injection keys', () => {
    const el = new MockElement('DIV');
    el.setAttribute('data-rt-template', 'ID: {{user-id++}}, Price: {{item$price}}');
    docElements.push(el);

    ((global as any).document.querySelectorAll as jest.Mock).mockReturnValue([el]);

    c._updateDOM('auth/user', {
      'user-id++': 'USR-101',
      'item$price': '$99'
    });

    expect(el.innerHTML).toBe('ID: USR-101, Price: $99');
  });
});
