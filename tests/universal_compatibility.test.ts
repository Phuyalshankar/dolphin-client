import { DolphinClient } from '../src/core';

describe('DolphinClient — Universal Backend Compatibility', () => {
    let client: any;

    beforeEach(() => {
        // Mock global document and window
        (global as any).document = {
            querySelector: jest.fn().mockReturnValue(null),
            querySelectorAll: jest.fn().mockReturnValue([]),
            cookie: '',
        };
        (global as any).window = global;
        client = new DolphinClient('http://localhost:3000');
    });

    afterEach(() => {
        delete (global as any).document;
        delete (global as any).window;
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. CSRF Token Detection
    // ─────────────────────────────────────────────────────────────────────────────
    describe('_findCSRFToken', () => {
        test('reads CSRF token from meta tags (Laravel/Express)', () => {
            const mockMeta = {
                getAttribute: (name: string) => {
                    if (name === 'content') return 'laravel-csrf-token-xyz';
                    return null;
                }
            };
            ((global as any).document.querySelector as jest.Mock).mockImplementation((selector: string) => {
                if (selector.includes('csrf-token')) return mockMeta;
                return null;
            });

            expect(client.api._findCSRFToken()).toBe('laravel-csrf-token-xyz');
        });

        test('reads CSRF token from hidden input (CakePHP/_csrfToken)', () => {
            const mockInput = { value: 'cakephp-csrf-token-123' };
            ((global as any).document.querySelector as jest.Mock).mockImplementation((selector: string) => {
                if (selector.includes('_csrfToken')) return mockInput;
                return null;
            });

            expect(client.api._findCSRFToken()).toBe('cakephp-csrf-token-123');
        });

        test('reads CSRF token from cookies (NestJS/Fastify)', () => {
            (global as any).document.cookie = 'csrfToken=cookie-csrf-token-abc; XSRF-TOKEN=other';

            expect(client.api._findCSRFToken()).toBe('cookie-csrf-token-abc');
        });

        test('reads WordPress Nonce from global settings', () => {
            (window as any).wpApiSettings = { nonce: 'wp-nonce-key-777' };
            expect(client.api._findCSRFToken()).toBe('wp-nonce-key-777');
            delete (window as any).wpApiSettings;
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. Base URL & Subfolder Auto-Detection
    // ─────────────────────────────────────────────────────────────────────────────
    describe('_resolveBaseUrl', () => {
        test('resolves absolute URLs untouched', () => {
            const url = client.api._resolveBaseUrl('https://another-domain.com/api/data');
            expect(url).toBe('https://another-domain.com/api/data');
        });

        test('auto-resolves using <base href="..."> subfolders', () => {
            const mockBase = {
                getAttribute: (name: string) => {
                    if (name === 'href') return '/my-subdirectory/';
                    return null;
                }
            };
            ((global as any).document.querySelector as jest.Mock).mockImplementation((selector: string) => {
                if (selector === 'base[href]') return mockBase;
                return null;
            });

            const url = client.api._resolveBaseUrl('/api/posts');
            expect(url).toBe('http://localhost:3000/my-subdirectory/api/posts');
        });

        test('auto-resolves using meta[name="base-path"] subfolders', () => {
            const mockMeta = {
                getAttribute: (name: string) => {
                    if (name === 'content') return '/sub-app';
                    return null;
                }
            };
            ((global as any).document.querySelector as jest.Mock).mockImplementation((selector: string) => {
                if (selector === 'meta[name="base-path"]') return mockMeta;
                return null;
            });

            const url = client.api._resolveBaseUrl('/v1/users');
            expect(url).toBe('http://localhost:3000/sub-app/v1/users');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. Validation Error Normalization
    // ─────────────────────────────────────────────────────────────────────────────
    describe('_normalizeValidationErrors', () => {
        test('normalizes Laravel style errors (Key to Array of Strings)', () => {
            const laravelErrors = {
                errors: {
                    email: ['The email field is required.', 'Must be a valid email.'],
                    password: ['Password is too short.']
                }
            };
            const result = client.api._normalizeValidationErrors(laravelErrors);
            expect(result).toEqual({
                email: 'The email field is required.',
                password: 'Password is too short.'
            });
        });

        test('normalizes CakePHP style errors (Key to Nested Objects)', () => {
            const cakeErrors = {
                errors: {
                    email: {
                        _required: 'Email address is required.'
                    },
                    username: {
                        unique: 'Username is already taken.'
                    }
                }
            };
            const result = client.api._normalizeValidationErrors(cakeErrors);
            expect(result).toEqual({
                email: 'Email address is required.',
                username: 'Username is already taken.'
            });
        });

        test('normalizes Node.js style errors (Array of Objects e.g. Joi/Express-validator)', () => {
            const nodeErrors = {
                errors: [
                    { path: 'email', msg: 'Invalid email parameter.' },
                    { param: 'age', msg: 'Must be at least 18.' }
                ]
            };
            const result = client.api._normalizeValidationErrors(nodeErrors);
            expect(result).toEqual({
                email: 'Invalid email parameter.',
                age: 'Must be at least 18.'
            });
        });

        test('handles simple key-value errors gracefully', () => {
            const simpleErrors = {
                username: 'Invalid username',
                role: 'Role does not exist'
            };
            const result = client.api._normalizeValidationErrors(simpleErrors);
            expect(result).toEqual({
                username: 'Invalid username',
                role: 'Role does not exist'
            });
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. HTTP Method Spoofing
    // ─────────────────────────────────────────────────────────────────────────────
    describe('HTTP Method Spoofing', () => {
        test('applies spoofing on PUT/PATCH/DELETE requests when enabled', async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({ success: true }),
            });
            (global as any).fetch = mockFetch;

            client.options.methodSpoofing = true;

            await client.api.requestDirect('PUT', '/posts/1', { title: 'Updated' });

            const [url, opts] = mockFetch.mock.calls[0];
            expect(opts.method).toBe('POST');
            expect(opts.headers['X-HTTP-Method-Override']).toBe('PUT');
            
            const parsedBody = JSON.parse(opts.body);
            expect(parsedBody._method).toBe('PUT');
            expect(parsedBody.title).toBe('Updated');

            delete (global as any).fetch;
        });

        test('does not apply spoofing by default', async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({ success: true }),
            });
            (global as any).fetch = mockFetch;

            await client.api.requestDirect('DELETE', '/posts/1');

            const [url, opts] = mockFetch.mock.calls[0];
            expect(opts.method).toBe('DELETE');
            expect(opts.headers['X-HTTP-Method-Override']).toBeUndefined();

            delete (global as any).fetch;
        });
    });
});
