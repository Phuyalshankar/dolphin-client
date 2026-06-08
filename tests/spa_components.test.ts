import { DolphinClient } from '../src/index';

describe('DolphinClient — Component Imports & SPA Routing', () => {
    let client: any;

    beforeEach(() => {
        // Mock global document and window
        (global as any).document = {
            querySelector: jest.fn().mockReturnValue(null),
            querySelectorAll: jest.fn().mockReturnValue([]),
            addEventListener: jest.fn(),
            createElement: jest.fn().mockImplementation((tag: string) => {
                return {
                    tagName: tag.toUpperCase(),
                    innerHTML: '',
                    setAttribute: jest.fn(),
                };
            }),
            head: {
                appendChild: jest.fn(),
            },
        };
        (global as any).window = {
            addEventListener: jest.fn(),
            location: {
                href: 'http://localhost:3000/',
                pathname: '/',
                origin: 'http://localhost:3000',
            },
            history: {
                pushState: jest.fn(),
            },
        };
        (global as any).DOMParser = class {
            parseFromString(html: string) {
                return {
                    title: 'New Page Title',
                    body: { innerHTML: 'New body content' },
                    querySelector: () => null,
                };
            }
        };

        client = new DolphinClient('http://localhost:3000');
    });

    afterEach(() => {
        delete (global as any).document;
        delete (global as any).window;
        delete (global as any).DOMParser;
        delete (global as any).fetch;
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. Declarative Component Imports
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Component Imports (_resolveImports)', () => {
        test('resolves and imports a basic component layout', async () => {
            const mockEl = {
                getAttribute: (name: string) => {
                    if (name === 'data-import') return 'header.html';
                    return null;
                },
                removeAttribute: jest.fn(),
                querySelectorAll: jest.fn().mockReturnValue([]),
                innerHTML: '',
            };

            ((global as any).document.querySelectorAll as jest.Mock).mockReturnValue([mockEl]);

            // Mock fetch to return some HTML
            (global as any).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                text: async () => '<header><h1>My Header Layout</h1></header>',
            });

            await client._resolveImports();

            expect(mockEl.innerHTML).toBe('<header><h1>My Header Layout</h1></header>');
            expect(mockEl.removeAttribute).toHaveBeenCalledWith('data-import');
            expect((global as any).fetch).toHaveBeenCalledWith('header.html');
        });

        test('uses cache for repeat component imports', async () => {
            const mockEl1 = {
                getAttribute: () => 'footer.html',
                removeAttribute: jest.fn(),
                querySelectorAll: jest.fn().mockReturnValue([]),
                innerHTML: '',
            };
            const mockEl2 = {
                getAttribute: () => 'footer.html',
                removeAttribute: jest.fn(),
                querySelectorAll: jest.fn().mockReturnValue([]),
                innerHTML: '',
            };

            ((global as any).document.querySelectorAll as jest.Mock).mockReturnValue([mockEl1, mockEl2]);

            // Mock fetch to return some HTML
            const fetchMock = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                text: async () => '<footer>Footer Content</footer>',
            });
            (global as any).fetch = fetchMock;

            await client._resolveImports();

            expect(mockEl1.innerHTML).toBe('<footer>Footer Content</footer>');
            expect(mockEl2.innerHTML).toBe('<footer>Footer Content</footer>');
            expect(fetchMock).toHaveBeenCalledTimes(1); // Fetched exactly once!
        });

        test('prevents circular component import locking', async () => {
            const mockEl = {
                getAttribute: () => 'loop.html',
                removeAttribute: jest.fn(),
                querySelectorAll: jest.fn().mockReturnValue([]),
                innerHTML: '',
            };

            ((global as any).document.querySelectorAll as jest.Mock).mockReturnValue([mockEl]);

            // Mock fetch to return some HTML that imports itself
            (global as any).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                text: async () => '<div data-import="loop.html"></div>',
            });

            // Store nested child reference to avoid advancing query mock callCount
            const nestedChild = {
                getAttribute: () => 'loop.html',
                removeAttribute: jest.fn(),
                querySelectorAll: () => [],
                innerHTML: '',
            };

            let callCount = 0;
            mockEl.querySelectorAll = jest.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    return [nestedChild];
                }
                return [];
            });

            await client._resolveImports();

            // The inner element should have a circular import warning and stop resolving
            expect(nestedChild.innerHTML).toContain('Circular import');
        });

        test('resolves selector-based component imports using url#id selector', async () => {
            const mockEl = {
                getAttribute: (name: string) => {
                    if (name === 'data-import') return 'components.html#header';
                    return null;
                },
                removeAttribute: jest.fn(),
                querySelectorAll: jest.fn().mockReturnValue([]),
                innerHTML: '',
            };

            ((global as any).document.querySelectorAll as jest.Mock).mockReturnValue([mockEl]);

            // Mock fetch to return the full HTML containing multiple components
            (global as any).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                text: async () => '<div><header id="header">Header Content</header><footer id="footer">Footer Content</footer></div>',
            });

            // Mock DOMParser to parse and return only the targeted selector
            const mockHeaderEl = { outerHTML: '<header id="header">Header Content</header>' };
            (global as any).DOMParser = class {
                parseFromString() {
                    return {
                        querySelector: (selector: string) => {
                            if (selector === '#header') return mockHeaderEl;
                            return null;
                        }
                    };
                }
            };

            await client._resolveImports();

            expect(mockEl.innerHTML).toBe('<header id="header">Header Content</header>');
            expect(mockEl.removeAttribute).toHaveBeenCalledWith('data-import');
            expect((global as any).fetch).toHaveBeenCalledWith('components.html');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. SPA Router Initialization
    // ─────────────────────────────────────────────────────────────────────────────
    describe('SPA Router (_initSPARouter)', () => {
        test('initializes and intercepts click on data-spa links', () => {
            client.addDomListener = jest.fn();
            client._routerInitialized = false;
            client._initSPARouter();

            expect(client.addDomListener).toHaveBeenCalledWith(document, 'click', expect.any(Function));
            expect(client.addDomListener).toHaveBeenCalledWith(window, 'popstate', expect.any(Function));
        });
    });
});
