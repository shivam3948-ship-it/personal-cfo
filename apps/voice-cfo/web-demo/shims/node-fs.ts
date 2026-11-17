// Browser build: no filesystem. lib/actions.ts already treats write failures as "memory only".
const fail = () => { throw new Error('no filesystem in the browser demo'); };
export default { readFileSync: fail, writeFileSync: fail, mkdirSync: fail, existsSync: () => false, readdirSync: () => [] };
export const readFileSync = fail; export const writeFileSync = fail; export const mkdirSync = fail;
