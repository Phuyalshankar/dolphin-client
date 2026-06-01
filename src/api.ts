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
                ? `${joined}/${subPath.startsWith('/') ? subPath.slice(1) : subPath}`
                : joined;
            return this.request(method, finalPath, body, options);
        };

        target.requestDirect = (method, path, body, options) => {
            return this.requestDirect(method, path, body, options);
        };

        const methods = ['get', 'post', 'put', 'patch', 'del', 'request', 'requestDirect'];

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
        const url = `${this.client.httpUrl}${path.startsWith('/') ? path : '/' + path}`;

        if (this.client.options.debug) {
            console.log(`%c🚀 [Dolphin API Request]:`, 'color: #3b82f6; font-weight: bold;', method.toUpperCase(), path, body || '');
        }

        const controller = new AbortController();
        const timeoutId  = setTimeout(
            () => controller.abort(),
            this.client.options.timeout
        );

        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        };
        if (this.client.accessToken) {
            headers['Authorization'] = `Bearer ${this.client.accessToken}`;
        }
        
        const fetchOptions = { ...options };
        delete fetchOptions._isRetry;

        try {
            const response = await fetch(url, {
                method,
                headers,
                signal: controller.signal,
                ...(body ? { body: JSON.stringify(body) } : {}),
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

        } catch (err) {
            clearTimeout(timeoutId);
            if (this.client.options.debug) {
                console.error(`%c❌ [Dolphin API Error]:`, 'color: #ef4444; font-weight: bold;', method.toUpperCase(), path, err);
            }
            if (err.name === 'AbortError') {
                throw { status: 408, data: { error: 'Request timed out' } };
            }
            throw err;
        }
    }
}
