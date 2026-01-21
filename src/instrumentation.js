// This file runs before the application starts
// It fixes the broken localStorage in Node.js 20+ with Next.js 15

export async function register() {
  if (typeof window === "undefined") {
    const hasBrokenStorage =
      typeof globalThis.localStorage?.getItem !== "function" ||
      typeof globalThis.sessionStorage?.getItem !== "function";

    if (!hasBrokenStorage) {
      return;
    }

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

    globalThis.localStorage = localStorageMock;
    globalThis.sessionStorage = localStorageMock;
  }
}
