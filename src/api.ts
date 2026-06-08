export class APIHandler {
    client: any;

    /** @param {DolphinClient} client */
    constructor(client) {
        this.client = client;
        return this._createProxy([]) as any;
    }

    /** @private */
    _createProxy(pathParts) {
        const joined = pathParts.join('/');

        const target = (options) => this.request('GET', joined, null, options);

        target.get  = (pathOrOptions, options) =>
            typeof pathOrOptions === 'string'
                ? this.request('GET', pathOrOptions, null, options)
                : this.request('GET', joined, null, pathOrOptions);

        target.post = (pathOrBody, bodyOrOptions, options) =>
            typeof pathOrBody === 'string'
                ? this.request('POST', pathOrBody, bodyOrOptions, options)
                : this.request('POST', joined, pathOrBody, bodyOrOptions);

        target.put  = (pathOrBody, bodyOrOptions, options) =>
            typeof pathOrBody === 'string'
                ? this.request('PUT', pathOrBody, bodyOrOptions, options)
                : this.request('PUT', joined, pathOrBody, bodyOrOptions);

        target.patch = (pathOrBody, bodyOrOptions, options) =>
            typeof pathOrBody === 'string'
                ? this.request('PATCH', pathOrBody, bodyOrOptions, options)
                : this.request('PATCH', joined, pathOrBody, bodyOrOptions);

        target.del  = (pathOrOptions, options) =>
            typeof pathOrOptions === 'string'
                ? this.request('DELETE', pathOrOptions, null, options)
                : this.request('DELETE', joined, null, pathOrOptions);

        target.request = (method, subPath, body, options) => {
            const finalPath = subPath
                ? (joined ? `${joined}/${subPath.startsWith('/') ? subPath.slice(1) : subPath}` : subPath)
                : joined;
            return this.request(method, finalPath, body, options);
        };

        target.requestDirect = (method, path, body, options) => {
            return this.requestDirect(method, path, body, options);
        };
        target._findCSRFToken = () => this._findCSRFToken();
        target._resolveBaseUrl = (path: string) => this._resolveBaseUrl(path);
        target._normalizeValidationErrors = (errData: any) => this._normalizeValidationErrors(errData);

        const methods = [
            'get', 'post', 'put', 'patch', 'del', 'request', 'requestDirect',
            '_findCSRFToken', '_resolveBaseUrl', '_normalizeValidationErrors'
        ];

        return new Proxy(target, {
            get: (t, prop) => {
                if (typeof prop === 'string' && !methods.includes(prop)) {
                    return this._createProxy([...pathParts, prop]);
                }
                return t[prop];
            }
        });
    }

    /**
     * Attempts to find a CSRF token in the document (meta tags, forms, or cookies).
     * Works for Laravel, CakePHP, WordPress, Express, NestJS, etc.
     * @private
     */
    _findCSRFToken(): string | null {
        if (typeof document === 'undefined') return null;

        // 1. Check meta tags
        const metaNames = ['csrf-token', '_csrf', 'xsrf-token', 'csrf_token'];
        for (const name of metaNames) {
            const metaEl = document.querySelector(`meta[name="${name}"], meta[content][name$="${name}"]`);
            if (metaEl) {
                const token = metaEl.getAttribute('content');
                if (token) return token;
            }
        }

        // 2. Check common hidden input names in forms
        const inputNames = ['_csrfToken', '_token', '_csrf', 'csrf_token'];
        for (const name of inputNames) {
            const inputEl = document.querySelector(`input[type="hidden"][name="${name}"]`) as HTMLInputElement;
            if (inputEl && inputEl.value) return inputEl.value;
        }

        // 3. Check cookies
        const cookies = ['csrfToken', 'XSRF-TOKEN', '_csrf', 'csrf_token'];
        for (const name of cookies) {
            const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
            if (match) return decodeURIComponent(match[2]);
        }

        // 4. WordPress Nonce meta tag or global object
        const wpNonce = typeof window !== 'undefined' && (window as any).wpApiSettings?.nonce;
        if (wpNonce) return wpNonce;

        return null;
    }

    /**
     * Dynamically resolves the Base Path/URL from `<base href="...">` or subfolders.
     * @private
     */
    _resolveBaseUrl(path: string): string {
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return path;
        }

        let baseUrl = this.client.httpUrl;

        if (typeof document !== 'undefined') {
            // Check <base href="...">
            const baseEl = document.querySelector('base[href]');
            if (baseEl) {
                const href = baseEl.getAttribute('href') || '';
                if (href && href !== '/') {
                    const cleanHref = href.endsWith('/') ? href.slice(0, -1) : href;
                    baseUrl = `${this.client.httpUrl}${cleanHref.startsWith('/') ? cleanHref : '/' + cleanHref}`;
                }
            } else {
                // Auto-detect subdirectory if not matching host exactly
                const metaBase = document.querySelector('meta[name="base-path"]');
                if (metaBase) {
                    const content = metaBase.getAttribute('content') || '';
                    if (content && content !== '/') {
                        const cleanContent = content.endsWith('/') ? content.slice(0, -1) : content;
                        baseUrl = `${this.client.httpUrl}${cleanContent.startsWith('/') ? cleanContent : '/' + cleanContent}`;
                    }
                }
            }
        }

        const cleanPath = path.startsWith('/') ? path : '/' + path;
        return `${baseUrl}${cleanPath}`;
    }

    /**
     * Normalizes backend validation errors from major PHP and Node.js frameworks
     * into a unified { [field]: message } object.
     * @private
     */
    _normalizeValidationErrors(errData: any): Record<string, string> {
        const normalized: Record<string, string> = {};

        if (!errData || typeof errData !== 'object') return normalized;

        const errors = errData.errors || errData.validationErrors || errData;

        // Case 1: Array of objects (Express-validator, Joi, Yup, Fastify)
        // e.g. [ { path: 'email', msg: 'invalid' } ]
        if (Array.isArray(errors)) {
            for (const err of errors) {
                if (err && typeof err === 'object') {
                    const field = err.path || err.param || err.field || err.property;
                    const msg = err.msg || err.message || err.error;
                    if (field && msg) {
                        normalized[field] = Array.isArray(msg) ? msg[0] : msg;
                    }
                }
            }
            return normalized;
        }

        // Case 2: Nested Object or Key-Value
        if (typeof errors === 'object' && errors !== null) {
            for (const key in errors) {
                const val = errors[key];
                if (!val) continue;

                // Case 2a: Value is an Array of strings (Laravel/Yii)
                if (Array.isArray(val)) {
                    if (val.length > 0) {
                        normalized[key] = String(val[0]);
                    }
                }
                // Case 2b: Value is an Object (CakePHP validation errors)
                else if (typeof val === 'object') {
                    const innerKeys = Object.keys(val);
                    if (innerKeys.length > 0) {
                        const firstInnerKey = innerKeys[0];
                        normalized[key] = String((val as any)[firstInnerKey]);
                    }
                }
                // Case 2c: Value is a simple string
                else {
                    normalized[key] = String(val);
                }
            }
        }

        return normalized;
    }

    /**
     * Intercept request for offline-first caching and queuing.
     */
    async request(method: string, path: string, body: any = null, options: any = {}) {
        if (this.client.offline) {
            const isOnline = this.client.offline.isOnline;
            const cacheKey = `${method.toUpperCase()}:${path}`;

            if (method.toUpperCase() === 'GET') {
                if (isOnline) {
                    try {
                        const result = await this.requestDirect(method, path, body, options);
                        await this.client.offline.setCache(cacheKey, result);
                        return result;
                    } catch (err) {
                        const cached = await this.client.offline.getCache(cacheKey);
                        if (cached !== undefined && cached !== null) {
                            return cached;
                        }
                        throw err;
                    }
                } else {
                    const cached = await this.client.offline.getCache(cacheKey);
                    if (cached !== undefined && cached !== null) {
                        return cached;
                    }
                    throw { status: 503, data: { error: 'Offline, no cache available' } };
                }
            } else {
                if (isOnline) {
                    return this.requestDirect(method, path, body, options);
                } else {
                    await this.client.offline.queueMutation(method, path, body);
                    this.client._dispatch('offline:queued', { method, path, body });
                    return { success: true, offline: true, message: 'Mutation queued offline' };
                }
            }
        }

        return this.requestDirect(method, path, body, options);
    }

    /**
     * Make an HTTP request with timeout + auto token refresh.
     * @param {string}      method
     * @param {string}      path
     * @param {any}         [body]
     * @param {RequestInit} [options]
     * @param {boolean}     [_isRetry=false]   — internal: prevent infinite refresh loop
     * @returns {Promise<any>}
     */
    async requestDirect(method, path, body = null, options: any = {}) {
        const _isRetry = options._isRetry === true;
        
        let finalMethod = method.toUpperCase();
        let finalBody = body;

        // Only set Content-Type for requests that have a body
        // GET/HEAD requests don't need it and it triggers unnecessary CORS preflight
        const hasBody = !['GET', 'HEAD'].includes(finalMethod);
        const headers = {
            ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {}),
        };

        // Universal HTTP Method Spoofing (Laravel, CakePHP, WordPress, Express)
        if (['PUT', 'PATCH', 'DELETE'].includes(finalMethod)) {
            if (this.client.options.methodSpoofing || options.methodSpoofing) {
                headers['X-HTTP-Method-Override'] = finalMethod;
                if (finalBody instanceof FormData) {
                    // @fix: FormData cannot be spread into a plain object — use append() instead (was: spread produced {})
                    finalBody.append('_method', finalMethod);
                } else if (finalBody && typeof finalBody === 'object') {
                    finalBody = {
                        ...finalBody,
                        _method: finalMethod
                    };
                } else if (!finalBody) {
                    finalBody = { _method: finalMethod };
                }
                finalMethod = 'POST';
            }
        }

        const url = this._resolveBaseUrl(path);

        if (this.client.options.debug) {
            console.log(`%c🚀 [Dolphin API Request]:`, 'color: #3b82f6; font-weight: bold;', method.toUpperCase(), path, finalBody || '');
        }

        const controller = new AbortController();
        const timeoutId  = setTimeout(
            () => controller.abort(),
            this.client.options.timeout
        );

        if (this.client.accessToken) {
            headers['Authorization'] = `Bearer ${this.client.accessToken}`;
        }

        // Auto-extract and inject CSRF and Nonce tokens (CakePHP, WordPress, Laravel, Node.js CSRF)
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
            const csrfToken = this._findCSRFToken();
            if (csrfToken) {
                headers['X-CSRF-Token'] = csrfToken;
                headers['X-XSRF-TOKEN'] = csrfToken;
                headers['X-CSRFToken'] = csrfToken;
                headers['X-WP-Nonce'] = csrfToken;

                if (finalBody && typeof finalBody === 'object') {
                    if (!finalBody._csrfToken && !finalBody._token && !finalBody._csrf) {
                        finalBody = {
                            ...finalBody,
                            _csrfToken: csrfToken,
                            _token: csrfToken,
                            _csrf: csrfToken
                        };
                    }
                }
            }
        }
        
        const fetchOptions = { ...options };
        delete fetchOptions._isRetry;
        delete fetchOptions.methodSpoofing;

        try {
            const response = await fetch(url, {
                method: finalMethod,
                headers,
                signal: controller.signal,
                ...(finalBody ? { body: JSON.stringify(finalBody) } : {}),
                ...fetchOptions,
            });

            clearTimeout(timeoutId);

            // Auto-refresh: 401 + not a retry + autoRefreshToken enabled
            if (
                response.status === 401 &&
                !_isRetry &&
                this.client.options.autoRefreshToken
            ) {
                const refreshed = await this.client.auth._silentRefresh();
                if (refreshed) {
                    return this.request(method, path, body, { ...options, _isRetry: true });
                }
            }

            const contentType = response.headers.get('content-type') || '';
            const data = contentType.includes('application/json')
                ? await response.json()
                : await response.text();

            if (!response.ok) throw { status: response.status, data };

            if (this.client.options.debug) {
                console.log(`%c✅ [Dolphin API Success]:`, 'color: #10b981; font-weight: bold;', method.toUpperCase(), path, data);
            }

            // Hookless auth token auto-save
            if (data && typeof data === 'object') {
                if (data.accessToken) {
                    this.client.setToken(data.accessToken);
                    if (data.user) this.client.auth.user = data.user;
                }
            }

            // Auto-broadcast data changes
            if (this.client.options.autoBroadcast && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
                const cleanPath = path.startsWith('/') ? path.substring(1) : path;
                this.client.publish(cleanPath, { method: method.toUpperCase(), payload: body, result: data });
            }

            return data;

        } catch (err: any) {
            clearTimeout(timeoutId);
            if (this.client.options.debug) {
                console.error(`%c❌ [Dolphin API Error]:`, 'color: #ef4444; font-weight: bold;', method.toUpperCase(), path, err);
            }

            // Auto-parse and publish validation errors to error bindings!
            if (err && typeof err === 'object' && err.data) {
                const normErrors = this._normalizeValidationErrors(err.data);
                if (Object.keys(normErrors).length > 0) {
                    for (const field in normErrors) {
                        this.client.publish(`errors/${field}`, normErrors[field]);
                    }
                }
            }

            if (err.name === 'AbortError') {
                throw { status: 408, data: { error: 'Request timed out' } };
            }
            throw err;
        }
    }
}

