const D = (globalThis as unknown as { ReactDOM: { createRoot: (el: Element) => { render: (n: unknown) => void } } }).ReactDOM;
export const createRoot = D.createRoot;
export default D;
