export const authFetch = (input: RequestInfo | URL, init: RequestInit = {}) =>
  fetch(input, {
    ...init,
    cache: init.cache ?? 'no-store',
    credentials: 'include',
  });
