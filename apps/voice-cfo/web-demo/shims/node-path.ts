const join = (...p: string[]) => p.filter(Boolean).join('/').replace(/\/+/g, '/');
export default { join, relative: (_a: string, b: string) => b, basename: (p: string) => p.split('/').pop() ?? p, dirname: (p: string) => p.split('/').slice(0, -1).join('/') };
export { join };
