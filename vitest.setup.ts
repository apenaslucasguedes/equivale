import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// jsdom não implementa estas APIs, usadas por gavetas/diálogos e pelo dnd-kit.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

if (!('scrollTo' in window)) {
  Object.defineProperty(window, 'scrollTo', { value: () => {}, writable: true });
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
