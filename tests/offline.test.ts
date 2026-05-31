export {};
const { DolphinClient } = require('../src/index');
const { APIHandler } = require('../src/api');

describe('Offline Persistence (IndexedDB & Memory Fallback)', () => {
  let c: any;
  let requestDirectMock: jest.Mock;

  beforeEach(() => {
    requestDirectMock = jest.fn();
    APIHandler.prototype.requestDirect = requestDirectMock;
    
    c = new DolphinClient('http://localhost:3000');
    c._initOffline();
    c.offline.isOnline = true; // start online
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Cache CRUD fallback stores and retrieves cache correctly', async () => {
    await c.offline.setCache('GET:/api/users', { users: ['Ram', 'Sita'] });
    const cached = await c.offline.getCache('GET:/api/users');
    expect(cached).toEqual({ users: ['Ram', 'Sita'] });
  });

  test('Mutation queue stores and removes mutations correctly', async () => {
    await c.offline.queueMutation('POST', '/api/users', { name: 'Gita' });
    let mutations = await c.offline.getMutations();
    expect(mutations.length).toBe(1);
    expect(mutations[0]).toMatchObject({
      method: 'POST',
      path: '/api/users',
      payload: { name: 'Gita' }
    });

    // Remove mutation
    if (mutations[0].id !== undefined) {
      await c.offline.removeMutation(mutations[0].id);
    } else {
      c.offline.memoryMutations.shift();
    }

    mutations = await c.offline.getMutations();
    expect(mutations.length).toBe(0);
  });

  test('HTTP GET requests are intercepted: online fetches and caches, offline reads cache', async () => {
    // 1. Online: fetches from network and updates cache
    requestDirectMock.mockResolvedValue({ success: true, fromNetwork: true });
    c.offline.isOnline = true;

    const res1 = await c.api.get('/api/resource');
    expect(res1).toEqual({ success: true, fromNetwork: true });
    expect(requestDirectMock).toHaveBeenCalledWith('GET', '/api/resource', null, {});

    // Verify cache is populated
    const cached = await c.offline.getCache('GET:/api/resource');
    expect(cached).toEqual({ success: true, fromNetwork: true });

    // 2. Offline: reads from cache and does NOT call network
    requestDirectMock.mockClear();
    c.offline.isOnline = false;

    const res2 = await c.api.get('/api/resource');
    expect(res2).toEqual({ success: true, fromNetwork: true });
    expect(requestDirectMock).not.toHaveBeenCalled();

    // 3. Offline without cache: throws an offline error
    await c.offline.setCache('GET:/api/non-existent', null); // clear cache
    await expect(c.api.get('/api/non-existent')).rejects.toMatchObject({
      status: 503
    });
  });

  test('HTTP POST/PUT mutating requests are intercepted: offline queues and returns mock success', async () => {
    // 1. Online: performs network request directly
    requestDirectMock.mockResolvedValue({ success: true, fromNetwork: true });
    c.offline.isOnline = true;

    const res1 = await c.api.post('/api/create', { item: 'Widget' });
    expect(res1).toEqual({ success: true, fromNetwork: true });
    expect(requestDirectMock).toHaveBeenCalledWith('POST', '/api/create', { item: 'Widget' }, {});

    // 2. Offline: queues mutation and returns mock response
    requestDirectMock.mockClear();
    c.offline.isOnline = false;

    const res2 = await c.api.post('/api/create', { item: 'Widget' });
    expect(res2).toEqual({
      success: true,
      offline: true,
      message: 'Mutation queued offline'
    });
    expect(requestDirectMock).not.toHaveBeenCalled();

    // Verify mutation is queued
    const mutations = await c.offline.getMutations();
    expect(mutations.length).toBe(1);
    expect(mutations[0]).toMatchObject({
      method: 'POST',
      path: '/api/create',
      payload: { item: 'Widget' }
    });
  });

  test('Sync engine automatically pushes mutations to network when going online', async () => {
    requestDirectMock.mockResolvedValue({ success: true });
    c.offline.isOnline = false;

    // Queue 2 mutations
    await c.api.post('/api/item1', { name: 'Item1' });
    await c.api.post('/api/item2', { name: 'Item2' });

    let mutations = await c.offline.getMutations();
    expect(mutations.length).toBe(2);

    // Simulate going online
    c.offline.isOnline = true;
    await c.offline.syncMutations();

    // Verify requestDirectMock called for both mutations
    expect(requestDirectMock).toHaveBeenCalledWith('POST', '/api/item1', { name: 'Item1' }, undefined);
    expect(requestDirectMock).toHaveBeenCalledWith('POST', '/api/item2', { name: 'Item2' }, undefined);

    // Verify queue is now empty
    mutations = await c.offline.getMutations();
    expect(mutations.length).toBe(0);
  });
});
