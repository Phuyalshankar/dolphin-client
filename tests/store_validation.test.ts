export {};
const { DolphinClient } = require('../src/index');
const { APIHandler } = require('../src/api');

class MockElement {
  tagName: string;
  nodeType: number;
  childNodes: MockElement[];
  attributes: { name: string; value: string }[];
  style: any;
  classList: {
    add: jest.Mock;
    remove: jest.Mock;
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
      remove: jest.fn()
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

  replaceChild(newChild: MockElement, oldChild: MockElement) {
    const idx = this.childNodes.indexOf(oldChild);
    if (idx !== -1) {
      this.childNodes[idx] = newChild;
      newChild.parentNode = this;
      oldChild.parentNode = null;
    }
    return newChild;
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
      if (current.tagName === selector.toUpperCase()) return current;
      current = current.parentNode;
    }
    return null;
  }

  querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    const traverse = (node: MockElement) => {
      node.childNodes.forEach(child => {
        if (selector.includes('data-store-write') && child.hasAttribute('data-store-write')) results.push(child);
        else if (selector.includes('data-store-read') && child.hasAttribute('data-store-read')) results.push(child);
        else if (selector.includes('data-rt-validate') && child.hasAttribute('data-rt-validate')) results.push(child);
        else if (selector.startsWith('[data-store-read^=') && child.hasAttribute('data-store-read')) {
          const prefix = selector.match(/data-store-read\^="([^"]+)"/)?.[1];
          if (prefix && child.getAttribute('data-store-read')?.startsWith(prefix)) {
            results.push(child);
          }
        } else if (selector.startsWith('[data-store-read="') && child.hasAttribute('data-store-read')) {
          const matchVal = selector.match(/data-store-read="([^"]+)"/)?.[1];
          if (matchVal && child.getAttribute('data-store-read') === matchVal) {
            results.push(child);
          }
        }
        traverse(child);
      });
    };
    traverse(this);
    return results;
  }
}

describe('Reactive Store & Declarative Validation', () => {
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
      querySelector: jest.fn().mockReturnValue(null),
      querySelectorAll: jest.fn().mockImplementation((sel) => {
        if (sel === '[data-store-write]') return docElements.filter(e => e.hasAttribute('data-store-write'));
        if (sel === '[data-store-read]') return docElements.filter(e => e.hasAttribute('data-store-read'));
        if (sel.startsWith('[data-store-read="')) {
          const matchVal = sel.match(/data-store-read="([^"]+)"/)?.[1];
          return docElements.filter(e => e.getAttribute('data-store-read') === matchVal);
        }
        return [];
      }),
      addEventListener: jest.fn(),
      createElement: jest.fn().mockImplementation((tag) => new MockElement(tag)),
      head: { insertBefore: jest.fn() }
    };
    (global as any).FormData = class {
      form: any;
      constructor(form: any) {
        this.form = form;
      }
      entries() {
        const entries: [string, string][] = [];
        if (this.form && this.form.childNodes) {
          this.form.childNodes.forEach((c: any) => {
            if (c.name) {
              entries.push([c.name, c.value]);
            }
          });
        }
        return entries;
      }
    };
    c = new DolphinClient('http://localhost:3000');
  });

  afterEach(() => {
    delete (global as any).document;
    delete (global as any).FormData;
  });

  // --- Local Reactive Store Tests ---

  test('setStoreState updates UI values and publishes topic state', async () => {
    const el1 = new MockElement('SPAN');
    el1.setAttribute('data-store-read', 'ui.theme');
    const el2 = new MockElement('INPUT');
    el2.setAttribute('data-store-read', 'ui.theme');
    docElements.push(el1, el2);

    c.publish = jest.fn();

    c.setStoreState('ui', 'theme', 'dark');

    expect(el1.textContent).toBe('dark');
    expect(el2.value).toBe('dark');
    expect(c.getStoreState('ui', 'theme')).toBe('dark');
    expect(c.publish).toHaveBeenCalledWith('store/ui', { theme: 'dark' });
  });

  test('input changes with data-store-write update store state', () => {
    const addEventListenerMock = (global as any).document.addEventListener;
    const inputHandlers: any[] = [];

    addEventListenerMock.mockImplementation((event: string, handler: any) => {
      if (event === 'input') inputHandlers.push(handler);
    });

    c._initDOMBinding();

    const inputEl = new MockElement('INPUT');
    inputEl.setAttribute('data-store-write', 'cart.qty');
    inputEl.value = '5';

    // Simulate input typing on all input listeners
    inputHandlers.forEach(handler => handler({ target: inputEl }));

    expect(c.getStoreState('cart', 'qty')).toBe('5');
  });

  test('_scanStoreBinds loads default DOM values into stores', () => {
    const writeEl = new MockElement('INPUT');
    writeEl.setAttribute('data-store-write', 'settings.notifications');
    writeEl.type = 'checkbox';
    writeEl.checked = true;
    docElements.push(writeEl);

    c._scanStoreBinds();

    expect(c.getStoreState('settings', 'notifications')).toBe(true);
  });

  // --- Declarative Validation Tests ---

  test('validateField validates email, required, min, and match rules correctly', () => {
    expect(c.validateField('', 'required')).toBe('This field is required');
    expect(c.validateField('Ram', 'required')).toBeNull();

    expect(c.validateField('invalid-email', 'email')).toBe('Please enter a valid email address');
    expect(c.validateField('ram@domain.com', 'email')).toBeNull();

    expect(c.validateField('abc', 'min:5')).toBe('Must be at least 5 characters');
    expect(c.validateField('abcdef', 'min:5')).toBeNull();

    const allVals = { password: 'secret123', confirmPassword: 'secret123' };
    expect(c.validateField('secret123', 'match:password', allVals)).toBeNull();
    expect(c.validateField('different', 'match:password', allVals)).toBe('Must match password');
  });

  test('submit event listener runs form validation and blocks submission if invalid', async () => {
    const addEventListenerMock = (global as any).document.addEventListener;
    const submitHandlers: any[] = [];

    addEventListenerMock.mockImplementation((event: string, handler: any) => {
      if (event === 'submit') submitHandlers.push(handler);
    });

    c._initDOMBinding();
    c.publish = jest.fn();

    const form = new MockElement('FORM');
    form.setAttribute('data-api-submit', 'POST /users');

    const inputEmail = new MockElement('INPUT');
    inputEmail.name = 'email';
    inputEmail.value = 'invalid-email';
    inputEmail.setAttribute('data-rt-validate', 'required,email');

    form.appendChild(inputEmail);

    form.querySelectorAll = jest.fn().mockReturnValue([inputEmail]);

    const eventMock = {
      target: form,
      preventDefault: jest.fn(),
      stopPropagation: jest.fn()
    };

    // Execute all submit handlers
    for (const handler of submitHandlers) {
      await handler(eventMock);
    }

    expect(eventMock.preventDefault).toHaveBeenCalled();
    expect(inputEmail.classList.add).toHaveBeenCalledWith('invalid');
    expect(c.publish).toHaveBeenCalledWith('errors/email', 'Please enter a valid email address');
  });

  test('checkbox change event updates store and checked property', () => {
    const addEventListenerMock = (global as any).document.addEventListener;
    const changeHandlers: any[] = [];

    addEventListenerMock.mockImplementation((event: string, handler: any) => {
      if (event === 'change') changeHandlers.push(handler);
    });

    c._initDOMBinding();

    const checkboxEl = new MockElement('INPUT');
    checkboxEl.setAttribute('data-store-write', 'register.check');
    checkboxEl.setAttribute('data-store-read', 'register.check');
    checkboxEl.type = 'checkbox';
    checkboxEl.checked = true; // browser toggles it on click before change event
    docElements.push(checkboxEl);

    // Simulate change event
    changeHandlers.forEach(handler => handler({ target: checkboxEl }));

    expect(c.getStoreState('register', 'check')).toBe(true);
    expect(checkboxEl.checked).toBe(true);
  });
});
