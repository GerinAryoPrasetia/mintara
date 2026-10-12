/**
 * Tests run in the `node` environment, which has no localStorage — zustand's
 * persist middleware then warns on every write. Give it an in-memory store so
 * test output stays clean and persistence behaves as it does in the browser.
 */
const store = new Map<string, string>()

if (!('localStorage' in globalThis)) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size
      },
    },
    configurable: true,
  })
}
