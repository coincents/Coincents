// This file runs before the application starts
// It fixes the broken localStorage in Node.js 20+ with Next.js 15

export async function register() {
  if (typeof window === "undefined") {
    // Server-side: provide a proper localStorage polyfill
    const localStorageMock = {
      _data: {},
      getItem(key) {
        return this._data[key] ?? null;
      },
      setItem(key, value) {
        this._data[key] = String(value);
      },
      removeItem(key) {
        delete this._data[key];
      },
      clear() {
        this._data = {};
      },
      key(index) {
        const keys = Object.keys(this._data);
        return keys[index] ?? null;
      },
      get length() {
        return Object.keys(this._data).length;
      },
    };

    // Override the broken localStorage
    globalThis.localStorage = localStorageMock;
    globalThis.sessionStorage = localStorageMock;
  }
}
