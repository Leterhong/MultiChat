import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrapServerSession, getServerToken, serverAuthHeaders, serverTokenStorageKey, setServerToken } from '../api';
import { state } from '../state';

describe('server API token isolation', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    state.apiBase = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('migrates a legacy token only for the page origin', () => {
    localStorage.setItem('multichat_server_token', 'legacy-token');

    expect(getServerToken()).toBe('legacy-token');
    expect(localStorage.getItem(serverTokenStorageKey())).toBe('legacy-token');
    expect(localStorage.getItem('multichat_server_token')).toBeNull();
  });

  it('never sends the page token to a different API origin', () => {
    setServerToken('page-token');
    const pageKey = serverTokenStorageKey();

    state.apiBase = 'http://127.0.0.1:3999';
    expect(getServerToken()).toBe('');
    expect(serverAuthHeaders()).toEqual({});

    setServerToken('other-service-token');
    expect(serverAuthHeaders()).toEqual({ Authorization: 'Bearer other-service-token' });
    expect(localStorage.getItem(pageKey)).toBe('page-token');
  });

  it('keeps an auto-bootstrapped token in sessionStorage, scoped to the page origin', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ token: 'auto-session-token', mode: 'auto' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const token = await bootstrapServerSession();
    expect(token).toBe('auto-session-token');
    expect(serverAuthHeaders()).toEqual({ Authorization: 'Bearer auto-session-token' });
    expect(localStorage.length).toBe(0);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe('/api/session');

    state.apiBase = 'http://127.0.0.1:3999';
    expect(getServerToken()).toBe('');
    expect(serverAuthHeaders()).toEqual({});
  });
});
