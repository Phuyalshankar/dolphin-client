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
    const parseHTMLToMockElements = (html: string): MockElement[] => {
      const results: MockElement[] = [];
      const tagRegex = /<(\/?)([a-zA-Z0-9:-]+)([^>]*?)>/g;
      let lastIndex = 0;
      let match;
      const stack: MockElement[] = [];

      while ((match = tagRegex.exec(html)) !== null) {
        const text = html.slice(lastIndex, match.index);
        if (text && text.trim()) {
          const txtNode = new MockElement('#text', 3);
          txtNode._textContent = text;
          if (stack.length > 0) {
            stack[stack.length - 1].appendChild(txtNode);
          } else {
            results.push(txtNode);
          }
        }

        const isClose = !!match[1];
        const tagName = match[2];
        const attrsStr = match[3];

        if (isClose) {
          stack.pop();
        } else {
          const el = new MockElement(tagName);
          const attrRegex = /([a-zA-Z0-9:-]+)(?:=(?:"([^"]*)"|'([^']*)'|{([^}]*)}|([^>\s]+)))?/g;
          let attrMatch;
          while ((attrMatch = attrRegex.exec(attrsStr)) !== null) {
            const attrName = attrMatch[1];
            let attrVal = attrMatch[2] || attrMatch[3] || attrMatch[4] || attrMatch[5] || '';
            if (attrMatch[4] !== undefined) {
              attrVal = `{${attrMatch[4]}}`;
            }
            if (attrName !== '/' && attrName !== '<' && attrName !== '>') {
              el.setAttribute(attrName, attrVal);
            }
          }

          if (stack.length > 0) {
            stack[stack.length - 1].appendChild(el);
          } else {
            results.push(el);
          }

          const isSelfClosing = attrsStr.trim().endsWith('/') || ['circle', 'line', 'polyline', 'polygon', 'path', 'img', 'input', 'br', 'hr', 'meta', 'link', 'base'].includes(tagName.toLowerCase());
          if (!isSelfClosing) {
            stack.push(el);
          }
        }
        lastIndex = tagRegex.lastIndex;
      }

      const remainingText = html.slice(lastIndex);
      if (remainingText && remainingText.trim()) {
        const txtNode = new MockElement('#text', 3);
        txtNode._textContent = remainingText;
        results.push(txtNode);
      }

      return results;
    };

    const parsed = parseHTMLToMockElements(val);
    parsed.forEach(c => this.appendChild(c));
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

  set outerHTML(html: string) {
    if (!this.parentNode) return;
    const temp = new MockElement('div');
    temp.innerHTML = html;
    const parent = this.parentNode;
    const idx = parent.childNodes.indexOf(this);
    if (idx !== -1) {
      parent.childNodes.splice(idx, 1, ...temp.childNodes);
      temp.childNodes.forEach(c => { c.parentNode = parent; });
    }
  }

  replaceChild(newChild: MockElement, oldChild: MockElement) {
    const idx = this.childNodes.indexOf(oldChild);
    if (idx !== -1) {
      this.childNodes[idx] = newChild;
      newChild.parentNode = this;
      oldChild.parentNode = null;
      return oldChild;
    }
    return null;
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

  insertBefore(newChild: MockElement, refChild: MockElement | null) {
    newChild.parentNode = this;
    if (refChild) {
      const idx = this.childNodes.indexOf(refChild);
      if (idx !== -1) {
        this.childNodes.splice(idx, 0, newChild);
        return newChild;
      }
    }
    this.childNodes.push(newChild);
    return newChild;
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
        if (child.nodeType === 1) {
          let matches = false;
          if (selector.startsWith('.')) {
            const className = selector.slice(1);
            const classAttr = child.getAttribute('class') || '';
            matches = classAttr.split(/\s+/).includes(className);
          } else if (selector.startsWith('[') && selector.endsWith(']')) {
            const attr = selector.slice(1, -1);
            matches = child.hasAttribute(attr);
          } else if (selector.includes(',')) {
            matches = selector.split(',').some(sel => {
              const cleaned = sel.trim().slice(1, -1);
              return child.hasAttribute(cleaned);
            });
          }
          if (matches) results.push(child);
          traverse(child);
        }
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
      querySelector: jest.fn().mockReturnValue(null),
      querySelectorAll: jest.fn().mockImplementation((sel) => {
        if (sel === '[data-i18n-key]') return docElements.filter(e => e.hasAttribute('data-i18n-key'));
        if (sel === '[data-i18n-dict]') return docElements.filter(e => e.hasAttribute('data-i18n-dict'));
        return [];
      }),
      addEventListener: jest.fn(),
      createElement: jest.fn().mockImplementation((tag) => new MockElement(tag)),
      head: { insertBefore: jest.fn() }
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

  test('Svelte-style block conditional rendering ({#if}, {:else if}, {:else}) evaluates correctly', () => {
    const el = new MockElement('DIV');
    el.setAttribute('data-rt-template', `
      {#if role === "admin"}
        Admin View: {{user}}
      {:else if role === "editor"}
        Editor View: {{user}}
      {:else}
        Guest View
      {/if}
    `);
    docElements.push(el);

    ((global as any).document.querySelectorAll as jest.Mock).mockReturnValue([el]);

    // Test Admin View
    c._updateDOM('auth/user', { role: 'admin', user: 'Shankar' });
    expect(el.innerHTML.trim()).toBe('Admin View: Shankar');

    // Test Editor View
    c._updateDOM('auth/user', { role: 'editor', user: 'Ram' });
    expect(el.innerHTML.trim()).toBe('Editor View: Ram');

    // Test Guest View
    c._updateDOM('auth/user', { role: 'guest', user: 'Hari' });
    expect(el.innerHTML.trim()).toBe('Guest View');
  });

  test('Robust template compilation handles backticks, nested object properties, and multi-line conditional chains', () => {
    const el = new MockElement('DIV');
    el.setAttribute('data-rt-template', `
      {#if user.role === "admin"}
        Admin Dashboard: \`Aurora\` Mode for {{user.name}}
      {:else if user.role === "editor"}
        Editor panel: {{user.name}}
      {:else if user.role === "viewer"}
        Viewer panel: {{user.name}}
      {:else}
        Guest Panel
      {/if}
    `);
    docElements.push(el);

    ((global as any).document.querySelectorAll as jest.Mock).mockReturnValue([el]);

    // Test Admin View with nested object
    c._updateDOM('auth/user', { user: { role: 'admin', name: 'Shankar' } });
    expect(el.innerHTML.trim()).toBe('Admin Dashboard: `Aurora` Mode for Shankar');

    // Test Editor View with nested object
    c._updateDOM('auth/user', { user: { role: 'editor', name: 'Ram' } });
    expect(el.innerHTML.trim()).toBe('Editor panel: Ram');

    // Test Guest View with nested object
    c._updateDOM('auth/user', { user: { role: 'guest', name: 'Hari' } });
    expect(el.innerHTML.trim()).toBe('Guest Panel');
  });

  test('Svelte-style loop blocks ({#each}), single curly mustaches ({var}), indices, and dynamic attributes evaluate correctly', () => {
    const el = new MockElement('DIV');
    el.setAttribute('data-rt-template', `
      <div class="notifications-container">
        {#if notifications.length > 0}
          <h3>You have {notifications.length} notifications</h3>
          {#each notifications as notification, index}
            <div class="item" data-api-click="POST /api/reply/{notification.id}">
              #{index}: {notification.from} -> {notification.message}
            </div>
          {/each}
        {:else}
          <h3>No notifications</h3>
        {/if}
      </div>
    `);
    docElements.push(el);

    ((global as any).document.querySelectorAll as jest.Mock).mockReturnValue([el]);

    // Test notifications array present
    c._updateDOM('alerts', {
      notifications: [
        { id: 101, from: 'Shankar', message: 'Hello!' },
        { id: 102, from: 'Ram', message: 'Hi there!' }
      ]
    });

    const output = el.innerHTML.replace(/\s+/g, ' ').trim();
    expect(output).toContain('You have 2 notifications');
    expect(output).toContain('data-api-click="POST /api/reply/101"');
    expect(output).toContain('#0: Shankar -> Hello!');
    expect(output).toContain('data-api-click="POST /api/reply/102"');
    expect(output).toContain('#1: Ram -> Hi there!');

    // Test empty notifications array
    c._updateDOM('alerts', { notifications: [] });
    expect(el.innerHTML.replace(/\s+/g, ' ').trim()).toContain('No notifications');
  });

  test('Nested Svelte-style conditional blocks ({#if}) compile and evaluate correctly', () => {
    const el = new MockElement('DIV');
    el.setAttribute('data-rt-template', `
      <div class="profile-container">
        {#if user}
          {#if user.verified}
            <div class="profile-card">
              <h2>{user.name}</h2>
              {#if user.premium}
                <div class="premium-badge">Premium</div>
              {:else}
                <div class="upgrade-badge">Upgrade</div>
              {/if}
            </div>
          {:else}
            <div class="verify-card">Verify Account</div>
          {/if}
        {:else}
          <div class="login-card">Login to Continue</div>
        {/if}
      </div>
    `);
    docElements.push(el);

    ((global as any).document.querySelectorAll as jest.Mock).mockReturnValue([el]);

    // Scenario 1: No user
    c._updateDOM('auth/user', { user: null });
    expect(el.innerHTML.replace(/\s+/g, ' ').trim()).toContain('Login to Continue');

    // Scenario 2: User present but unverified
    c._updateDOM('auth/user', { user: { name: 'Shankar', verified: false, premium: false } });
    expect(el.innerHTML.replace(/\s+/g, ' ').trim()).toContain('Verify Account');

    // Scenario 3: User verified but not premium
    c._updateDOM('auth/user', { user: { name: 'Shankar', verified: true, premium: false } });
    const out3 = el.innerHTML.replace(/\s+/g, ' ').trim();
    expect(out3).toContain('<h2>Shankar</h2>');
    expect(out3).toContain('Upgrade');
    expect(out3).not.toContain('Premium');

    // Scenario 4: User verified and premium
    c._updateDOM('auth/user', { user: { name: 'Shankar', verified: true, premium: true } });
    const out4 = el.innerHTML.replace(/\s+/g, ' ').trim();
    expect(out4).toContain('<h2>Shankar</h2>');
    expect(out4).toContain('Premium');
    expect(out4).not.toContain('Upgrade');
  });

  test('Fast-path template rendering (no block blocks) correctly resolves nested object properties like rating.rate', () => {
    const el = new MockElement('DIV');
    el.setAttribute('data-rt-template', 'ID: {{id}}, Title: {{title}}, Rating: {{rating.rate}}, Count: {{rating?.count}}');
    docElements.push(el);

    ((global as any).document.querySelectorAll as jest.Mock).mockReturnValue([el]);

    c._updateDOM('products/current', {
      id: 42,
      title: 'Dolphin Figurine',
      rating: {
        rate: 4.8,
        count: 150
      }
    });

    expect(el.innerHTML).toBe('ID: 42, Title: Dolphin Figurine, Rating: 4.8, Count: 150');
  });

  test('Store actions correctly resolve local context variables', () => {
    const parentEl = new MockElement('DIV') as any;
    parentEl._rtContext = { id: 42, title: 'Dolphin' };
    
    const childEl = new MockElement('BUTTON') as any;
    childEl.parentNode = parentEl;
    
    c.uiStores = new Map();
    c._executeStoreAction('app.editId = id; app.editTitle = title;', childEl);
    
    expect(c.getStoreState('app', 'editId')).toBe(42);
    expect(c.getStoreState('app', 'editTitle')).toBe('Dolphin');
  });

  test('data-rt-text evaluates complex expressions with context', () => {
    const el = new MockElement('DIV');
    el.setAttribute('data-rt-bind', 'store/app');
    el.setAttribute('data-rt-type', 'context');

    const textEl = new MockElement('SPAN');
    textEl.setAttribute('data-rt-text', "editId ? 'Edit Product' : 'Add New Product'");
    el.appendChild(textEl);

    // Mock document.querySelectorAll to return textEl when querying inside el
    el.querySelectorAll = jest.fn().mockReturnValue([textEl]);
    (global as any).document.querySelectorAll = jest.fn().mockImplementation((sel) => {
      if (sel === '[data-rt-bind="store/app"]') return [el];
      return [];
    });

    c._updateDOM('store/app', { editId: null });
    expect(textEl.textContent).toBe('Add New Product');

    c._updateDOM('store/app', { editId: 42 });
    expect(textEl.textContent).toBe('Edit Product');
  });

  test('data-rt-attr evaluates complex expressions containing commas and colons in strings', () => {
    const el = new MockElement('DIV');
    el.setAttribute('data-rt-bind', 'store/app');
    el.setAttribute('data-rt-type', 'context');

    const formEl = new MockElement('FORM');
    formEl.setAttribute('data-rt-attr', "data-api-submit: editId ? 'PUT https://api.com/products/' + editId : 'POST https://api.com/products', data-api-toast: editId ? 'Updated, yes!' : 'Created, hooray!'");
    el.appendChild(formEl);

    el.querySelectorAll = jest.fn().mockReturnValue([formEl]);
    (global as any).document.querySelectorAll = jest.fn().mockImplementation((sel) => {
      if (sel === '[data-rt-bind="store/app"]') return [el];
      return [];
    });

    c._updateDOM('store/app', { editId: null });
    expect(formEl.getAttribute('data-api-submit')).toBe('POST https://api.com/products');
    expect(formEl.getAttribute('data-api-toast')).toBe('Created, hooray!');

    c._updateDOM('store/app', { editId: 77 });
    expect(formEl.getAttribute('data-api-submit')).toBe('PUT https://api.com/products/77');
    expect(formEl.getAttribute('data-api-toast')).toBe('Updated, yes!');
  });

  test('Store actions support log() helper for logging stores and variables', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    
    c.uiStores = new Map();
    c.setStoreState('register', 'name', 'Ram');
    c.setStoreState('app', 'isAdding', true);
    
    // Test 1: Log specific store
    c._executeStoreAction('log(register);');
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('[Dolphin Store: register]'),
      expect.any(String),
      expect.objectContaining({ name: 'Ram' })
    );
    
    // Test 2: Log all UI stores (when no argument is passed)
    c._executeStoreAction('log();');
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('[Dolphin All UI Stores]'),
      expect.any(String),
      expect.objectContaining({
        register: expect.objectContaining({ name: 'Ram' }),
        app: expect.objectContaining({ isAdding: true })
      })
    );
    
    // Test 3: Log random variable/value
    c._executeStoreAction('log("Hello World");');
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('[Dolphin Log]'),
      expect.any(String),
      'Hello World'
    );
    
    spy.mockRestore();
  });

  test('dolphin-store parses attributes with type conversions and seeds store', () => {
    const storeEl = new MockElement('dolphin-store') as any;
    storeEl.setAttribute('name', 'settings');
    storeEl.setAttribute('theme', 'dark');
    storeEl.setAttribute('isModalOpen', 'false');
    storeEl.setAttribute('total', '42');
    storeEl.setAttribute('nullable', 'null');
    // No child elements — seed-only mode
    storeEl.childNodes = [];

    (global as any).document.querySelectorAll = jest.fn().mockImplementation((sel) => {
      if (sel === 'dolphin-store') return [storeEl];
      return [];
    });

    c.uiStores = new Map();
    c._scanStoreBinds();

    expect(c.getStoreState('settings', 'theme')).toBe('dark');
    expect(c.getStoreState('settings', 'isModalOpen')).toBe(false);
    expect(c.getStoreState('settings', 'total')).toBe(42);
    expect(c.getStoreState('settings', 'nullable')).toBeNull();
    // Seed-only mode: element should be hidden
    expect(storeEl.style.display).toBe('none');
  });

  test('dolphin-store parses inline JSON content and seeds store', () => {
    const storeEl = new MockElement('dolphin-store') as any;
    storeEl.setAttribute('data-store', 'app');
    // Set _textContent directly so childNodes stays empty (seed-only mode)
    const jsonStr = JSON.stringify({
      user: { name: 'Shankar' },
      loggedIn: true,
      count: 10
    });
    storeEl._textContent = jsonStr;
    // Override textContent getter to return our JSON string directly
    Object.defineProperty(storeEl, 'textContent', { get: () => jsonStr, configurable: true });
    // No child elements — seed-only mode
    storeEl.childNodes = [];

    (global as any).document.querySelectorAll = jest.fn().mockImplementation((sel) => {
      if (sel === 'dolphin-store') return [storeEl];
      return [];
    });

    c.uiStores = new Map();
    c._scanStoreBinds();

    expect(c.getStoreState('app', 'user')).toEqual({ name: 'Shankar' });
    expect(c.getStoreState('app', 'loggedIn')).toBe(true);
    expect(c.getStoreState('app', 'count')).toBe(10);
    // Seed-only mode: element should be hidden
    expect(storeEl.style.display).toBe('none');
  });


  test('dolphin-store with children acts as context container (dual-mode)', () => {
    const childEl = new MockElement('SPAN') as any;
    childEl.setAttribute('data-rt-text', 'username');

    const storeEl = new MockElement('dolphin-store') as any;
    storeEl.setAttribute('name', 'profile');
    storeEl.setAttribute('username', 'Shankar');

    // Has child elements — dual-mode (context container + store seeder)
    storeEl.appendChild(childEl);

    storeEl.querySelectorAll = jest.fn().mockReturnValue([childEl]);

    (global as any).document.querySelectorAll = jest.fn().mockImplementation((sel) => {
      if (sel === 'dolphin-store') return [storeEl];
      if (sel === '[data-rt-bind="store/profile"]') return [storeEl];
      return [];
    });

    c.uiStores = new Map();
    c._scanStoreBinds();

    // Store should be seeded
    expect(c.getStoreState('profile', 'username')).toBe('Shankar');
    // Element should NOT be hidden (it has children to display)
    expect(storeEl.style.display).not.toBe('none');
    // Element should have data-rt-bind and data-rt-type set automatically
    expect(storeEl.getAttribute('data-rt-bind')).toBe('store/profile');
    expect(storeEl.getAttribute('data-rt-type')).toBe('context');
    // Child should have text updated
    expect(childEl.textContent).toBe('Shankar');
  });

  test('dolphin-store auto-wires template wrapper element and renders it', () => {
    const storeEl = new MockElement('dolphin-store') as any;
    storeEl.setAttribute('name', 'app');
    storeEl.setAttribute('template', '#counter-ui');
    storeEl.setAttribute('count', '5');
    storeEl.childNodes = [];

    const parentEl = new MockElement('DIV') as any;
    parentEl.appendChild(storeEl);

    const templateEl = new MockElement('template') as any;
    templateEl.innerHTML = 'Count: {{count}}';

    (global as any).document.querySelectorAll = jest.fn().mockImplementation((sel) => {
      if (sel === 'dolphin-store') return [storeEl];
      if (sel === '[data-rt-bind="store/app"]') return parentEl.childNodes.filter((c: any) => c.getAttribute && c.getAttribute('data-rt-bind') === 'store/app');
      return [];
    });

    (global as any).document.querySelector = jest.fn().mockImplementation((sel) => {
      if (sel === '#counter-ui') return templateEl;
      if (sel.startsWith('[data-ds-wired=')) return null;
      return null;
    });

    c.uiStores = new Map();
    c._scanStoreBinds();

    // Store should be seeded
    expect(c.getStoreState('app', 'count')).toBe(5);

    // It should have injected a wrapper element
    const siblings = parentEl.childNodes;
    expect(siblings.length).toBe(2);
    const wrapper = siblings[1];
    expect(wrapper.tagName).toBe('DIV');
    expect(wrapper.getAttribute('data-rt-bind')).toBe('store/app');
    expect(wrapper.getAttribute('template')).toBeNull(); // Should be data-rt-template, not template
    expect(wrapper.getAttribute('data-rt-template')).toBe('#counter-ui');
    
    // Check if the template rendered inside the wrapper
    expect(wrapper.innerHTML).toContain('Count: 5');
  });

  test('Declarative Virtual Scroll rendering slices items correctly', () => {
    const parentEl = new MockElement('div') as any;
    parentEl.addEventListener = jest.fn();
    parentEl.setAttribute('data-rt-bind', 'store/products');
    parentEl.setAttribute('data-rt-virtual', 'true');
    parentEl.setAttribute('data-rt-item-height', '100');
    parentEl.setAttribute('data-rt-buffer', '2');
    
    const templateEl = new MockElement('template') as any;
    templateEl.innerHTML = '<div class="product-item">{{name}}</div>';
    
    parentEl.setAttribute('data-rt-template', '#product-template');

    const origQuerySelectorAll = (global as any).document.querySelectorAll;
    const origQuerySelector = (global as any).document.querySelector;
    const origGetComputedStyle = (global as any).window ? (global as any).window.getComputedStyle : undefined;

    (global as any).document.querySelectorAll = jest.fn().mockImplementation((sel) => {
      if (sel === '[data-rt-bind="store/products"]') return [parentEl];
      return [];
    });

    (global as any).document.querySelector = jest.fn().mockImplementation((sel) => {
      if (sel === '#product-template') return templateEl;
      return null;
    });

    (global as any).window = (global as any).window || {};
    (global as any).window.getComputedStyle = jest.fn().mockReturnValue({
      overflowY: 'visible',
      overflow: 'visible',
      position: 'static'
    });

    // Reuse existing c client
    const mockItems = Array.from({ length: 100 }, (_, i) => ({ name: `Product ${i}` }));
    c.setStoreState('products', 'items', mockItems);
    
    // Trigger render
    c._updateDOM('store/products', { items: mockItems });
    
    expect(parentEl.innerHTML).toContain('Product 0');
    expect(parentEl.innerHTML).toContain('Product 9');
    expect(parentEl.innerHTML).not.toContain('Product 10');
    
    expect(parentEl.innerHTML).toContain('class="rt-virtual-spacer-top"');
    expect(parentEl.innerHTML).toContain('class="rt-virtual-spacer-bottom"');

    // Restore globals
    (global as any).document.querySelectorAll = origQuerySelectorAll;
    (global as any).document.querySelector = origQuerySelector;
    delete (global as any).window;
  });

  test('React JSX style attributes and syntax are compiled without errors', () => {
    const parentEl = new MockElement('div') as any;
    parentEl.setAttribute('data-rt-bind', 'store/app');
    
    const templateEl = new MockElement('template') as any;
    templateEl.innerHTML = `
      <div className="react-card" onClick="alert(1)" key={id}>
        {name}
        <Search className="w-4 h-4" />
        {showDetail ? <span>Detail Text</span> : <span>Summary Text</span>}
        {isAdmin && <button>Delete Admin</button>}
      </div>
    `;
    
    parentEl.setAttribute('data-rt-template', '#react-template');

    const origQuerySelectorAll = (global as any).document.querySelectorAll;
    const origQuerySelector = (global as any).document.querySelector;

    (global as any).document.querySelectorAll = jest.fn().mockImplementation((sel) => {
      if (sel === '[data-rt-bind="store/app"]') return [parentEl];
      if (sel === 'dolphin-icon-spacer') return parentEl.querySelectorAll('dolphin-icon-spacer');
      return [];
    });

    (global as any).document.querySelector = jest.fn().mockImplementation((sel) => {
      if (sel === '#react-template') return templateEl;
      return null;
    });

    const mockStorage: Record<string, string> = {};
    (global as any).localStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => { mockStorage[key] = val; }
    };
    (global as any).localStorage.setItem(
      'dolphin-icon-search',
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>'
    );

    const context = { id: 42, name: 'React Test', showDetail: true, isAdmin: true };
    c.setStoreState('app', 'id', 42);
    c.setStoreState('app', 'name', 'React Test');
    c.setStoreState('app', 'showDetail', true);
    c.setStoreState('app', 'isAdmin', true);
    c._updateDOM('store/app', context);

    // Synchronous checks — these happen immediately after _updateDOM
    expect(parentEl.innerHTML).toContain('class="react-card"');
    expect(parentEl.innerHTML).toContain('onclick="alert(1)"');
    expect(parentEl.innerHTML).toContain('data-key="42"');
    expect(parentEl.innerHTML).toContain('React Test');

    // Spacer tag should be present before hydration fires
    expect(parentEl.innerHTML).toContain('data-icon-name="search"');
    expect(parentEl.innerHTML).toContain('dolphin-icon-spacer');
    expect(parentEl.innerHTML).toContain('w-4 h-4');

    // Directly call hydrateIcons on the parentEl to test hydration synchronously,
    // bypassing the async RAF scheduler
    const { hydrateIcons } = require('../src/dom/index');
    hydrateIcons(parentEl);

    // After hydration: spacer should be replaced with cached SVG
    // Note: injectClasses puts class before xmlns, so check attributes independently
    expect(parentEl.innerHTML).toContain('<svg');
    expect(parentEl.innerHTML).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(parentEl.innerHTML).toContain('w-4 h-4');
    expect(parentEl.innerHTML).toContain('<circle cx="11" cy="11" r="8"');

    // Check JSX logic compilation
    expect(parentEl.innerHTML).toContain('Detail Text');
    expect(parentEl.innerHTML).not.toContain('Summary Text');
    expect(parentEl.innerHTML).toContain('Delete Admin');

    (global as any).document.querySelectorAll = origQuerySelectorAll;
    (global as any).document.querySelector = origQuerySelector;
    delete (global as any).localStorage;
  });

  test('dolphin-store with children acts as context container (dual-mode)', () => {
    const childEl = new MockElement('SPAN') as any;
    childEl.setAttribute('data-rt-text', 'username');

    const storeEl = new MockElement('dolphin-store') as any;
    storeEl.setAttribute('name', 'profile');
    storeEl.setAttribute('username', 'Shankar');

    // Has child elements — dual-mode (context container + store seeder)
    storeEl.appendChild(childEl);

    storeEl.querySelectorAll = jest.fn().mockReturnValue([childEl]);

    (global as any).document.querySelectorAll = jest.fn().mockImplementation((sel) => {
      if (sel === 'dolphin-store') return [storeEl];
      if (sel === '[data-rt-bind="store/profile"]') return [storeEl];
      return [];
    });

    c.uiStores = new Map();
    c._scanStoreBinds();

    // Store should be seeded
    expect(c.getStoreState('profile', 'username')).toBe('Shankar');
    // Element should NOT be hidden (it has children to display)
    expect(storeEl.style.display).not.toBe('none');
    // Element should have data-rt-bind and data-rt-type set automatically
    expect(storeEl.getAttribute('data-rt-bind')).toBe('store/profile');
    expect(storeEl.getAttribute('data-rt-type')).toBe('context');
    // Child should have text updated
    expect(childEl.textContent).toBe('Shankar');
  });

  test('dolphin-store auto-wires template wrapper element and renders it', () => {
    const storeEl = new MockElement('dolphin-store') as any;
    storeEl.setAttribute('name', 'app');
    storeEl.setAttribute('template', '#counter-ui');
    storeEl.setAttribute('count', '5');
    storeEl.childNodes = [];

    const parentEl = new MockElement('DIV') as any;
    parentEl.appendChild(storeEl);

    const templateEl = new MockElement('template') as any;
    templateEl.innerHTML = 'Count: {{count}}';

    (global as any).document.querySelectorAll = jest.fn().mockImplementation((sel) => {
      if (sel === 'dolphin-store') return [storeEl];
      if (sel === '[data-rt-bind="store/app"]') return parentEl.childNodes.filter((c: any) => c.getAttribute && c.getAttribute('data-rt-bind') === 'store/app');
      return [];
    });

    (global as any).document.querySelector = jest.fn().mockImplementation((sel) => {
      if (sel === '#counter-ui') return templateEl;
      if (sel.startsWith('[data-ds-wired=')) return null;
      return null;
    });

    c.uiStores = new Map();
    c._scanStoreBinds();

    // Store should be seeded
    expect(c.getStoreState('app', 'count')).toBe(5);

    // It should have injected a wrapper element
    const siblings = parentEl.childNodes;
    expect(siblings.length).toBe(2);
    const wrapper = siblings[1];
    expect(wrapper.tagName).toBe('DIV');
    expect(wrapper.getAttribute('data-rt-bind')).toBe('store/app');
    expect(wrapper.getAttribute('template')).toBeNull(); // Should be data-rt-template, not template
    expect(wrapper.getAttribute('data-rt-template')).toBe('#counter-ui');
    
    // Check if the template rendered inside the wrapper
    expect(wrapper.innerHTML).toContain('Count: 5');
  });

  test('Declarative Virtual Scroll rendering slices items correctly', () => {
    const parentEl = new MockElement('div') as any;
    parentEl.addEventListener = jest.fn();
    parentEl.setAttribute('data-rt-bind', 'store/products');
    parentEl.setAttribute('data-rt-virtual', 'true');
    parentEl.setAttribute('data-rt-item-height', '100');
    parentEl.setAttribute('data-rt-buffer', '2');
    
    const templateEl = new MockElement('template') as any;
    templateEl.innerHTML = '<div class="product-item">{{name}}</div>';
    
    parentEl.setAttribute('data-rt-template', '#product-template');

    const origQuerySelectorAll = (global as any).document.querySelectorAll;
    const origQuerySelector = (global as any).document.querySelector;
    const origGetComputedStyle = (global as any).window ? (global as any).window.getComputedStyle : undefined;

    (global as any).document.querySelectorAll = jest.fn().mockImplementation((sel) => {
      if (sel === '[data-rt-bind="store/products"]') return [parentEl];
      return [];
    });

    (global as any).document.querySelector = jest.fn().mockImplementation((sel) => {
      if (sel === '#product-template') return templateEl;
      return null;
    });

    (global as any).window = (global as any).window || {};
    (global as any).window.getComputedStyle = jest.fn().mockReturnValue({
      overflowY: 'visible',
      overflow: 'visible',
      position: 'static'
    });

    // Reuse existing c client
    const mockItems = Array.from({ length: 100 }, (_, i) => ({ name: `Product ${i}` }));
    c.setStoreState('products', 'items', mockItems);
    
    // Trigger render
    c._updateDOM('store/products', { items: mockItems });
    
    expect(parentEl.innerHTML).toContain('Product 0');
    expect(parentEl.innerHTML).toContain('Product 9');
    expect(parentEl.innerHTML).not.toContain('Product 10');
    
    expect(parentEl.innerHTML).toContain('class="rt-virtual-spacer-top"');
    expect(parentEl.innerHTML).toContain('class="rt-virtual-spacer-bottom"');

    // Restore globals
    (global as any).document.querySelectorAll = origQuerySelectorAll;
    (global as any).document.querySelector = origQuerySelector;
    delete (global as any).window;
  });
});
