// Makes `React` available to the classic JSX transform in every bundled file.
export const React = (globalThis as unknown as { React: typeof import('react') }).React;
