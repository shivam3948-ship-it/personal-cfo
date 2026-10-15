// React comes from the cdnjs UMD build (window.React); this module re-exports it for bundled imports.
const R = (globalThis as unknown as { React: typeof import('react') }).React;
export default R;
export const { useState, useEffect, useRef, useCallback, useMemo, Fragment, createElement } = R;
