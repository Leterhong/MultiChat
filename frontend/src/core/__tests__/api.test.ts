import { beforeEach, describe, expect, it } from 'vitest';
import { getServerToken, serverAuthHeaders, serverTokenStorageKey, setServerToken } from '../api';
import { state } from '../state';

describe('server API token isolation', () => {
  beforeEach(() => {
    localStorage.clear();
    state.apiBase = '';
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
});
