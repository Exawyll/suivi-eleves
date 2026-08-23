// Reproduces Node 26 in CI: the Web Storage global exists but reads undefined.
Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true })
