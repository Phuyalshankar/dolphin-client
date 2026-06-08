// Helper to create mock functions safely without throwing ReferenceError when Jest is not present.
function createMockFn(): any {
  if (typeof jest !== 'undefined' && typeof jest.fn === 'function') {
    return jest.fn();
  }
  const fn: any = (...args: any[]) => {
    fn.mock.calls.push(args);
    if (fn._implementation) {
      return fn._implementation(...args);
    }
    return fn._returnValue;
  };
  fn.mock = {
    calls: []
  };
  fn._returnValue = undefined;
  fn._implementation = null;
  fn.mockReturnValue = (val: any) => {
    fn._returnValue = val;
    return fn;
  };
  fn.mockImplementation = (impl: any) => {
    fn._implementation = impl;
    return fn;
  };
  return fn;
}

export class DolphinTestUtils {
  static render(html: string): { container: any; find: (sel: string) => any; fireEvent: (el: any, eventType: string) => void } {
    if (typeof document === 'undefined') {
      throw new Error('DolphinTestUtils.render requires a DOM document environment to execute.');
    }
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    return {
      container,
      find: (sel: string) => container.querySelector(sel),
      fireEvent: (el: any, eventType: string) => {
        const evt = document.createEvent('Event');
        evt.initEvent(eventType, true, true);
        el.dispatchEvent(evt);
      }
    };
  }

  static mockWebSocket() {
    const sentMessages: string[] = [];
    const mockWS = {
      readyState: 1, // OPEN
      send: (data: string) => {
        sentMessages.push(data);
      },
      close: createMockFn(),
      onopen: createMockFn(),
      onmessage: createMockFn(),
      onclose: createMockFn(),
      onerror: createMockFn(),
      sentMessages
    };

    (global as any).WebSocket = class {
      static OPEN = 1;
      readyState = mockWS.readyState;
      send = mockWS.send;
      close = mockWS.close;
      set onopen(v: any) { mockWS.onopen = v; }
      get onopen() { return mockWS.onopen; }
      set onmessage(v: any) { mockWS.onmessage = v; }
      get onmessage() { return mockWS.onmessage; }
      set onclose(v: any) { mockWS.onclose = v; }
      get getonclose() { return mockWS.onclose; }
      constructor() {
        setTimeout(() => mockWS.onopen && mockWS.onopen(), 0);
      }
    } as any;

    return mockWS;
  }

  static simulateClick(el: any) {
    const clickEvt = {
      target: el,
      preventDefault: createMockFn(),
      stopPropagation: createMockFn()
    };
    // Trigger all document click listeners manually in Node or standard browser dispatcher
    const clickListeners = (global as any).document._listeners?.['click'] || [];
    clickListeners.forEach((listener: any) => listener(clickEvt));
  }

  static simulateChange(el: any, value: string) {
    el.value = value;
    const changeEvt = {
      target: el,
      preventDefault: createMockFn(),
      stopPropagation: createMockFn()
    };
    const changeListeners = (global as any).document._listeners?.['change'] || [];
    changeListeners.forEach((listener: any) => listener(changeEvt));
  }
}

export function attachTesting(clientProto: any) {
  clientProto.testing = DolphinTestUtils;
}

