// Types for the owner's advice picks (D-066). The picks themselves live in lib/server/advicePicks.ts, which only server code
// imports, so they never ship in the phone's JavaScript; a browser gets them from /api/advice/picks only when unlocked.
export interface Pick { name: string; why: string; source: string; checkedOn: string }
export type FundNeed = 'liquid' | 'short_term_debt' | 'hybrid_multi_asset' | 'index_large_cap' | 'flexi_cap' | 'elss';
export type InsuranceNeed = 'term' | 'health';
export interface Picks { funds: Record<FundNeed, Pick[]>; insurance: Record<InsuranceNeed, Pick[]> }
export const NO_PICKS: Picks = { funds: { liquid: [], short_term_debt: [], hybrid_multi_asset: [], index_large_cap: [], flexi_cap: [], elss: [] }, insurance: { term: [], health: [] } };
/** Every product name in the picks (the only names advice mode may use to say "buy this"). */
export const pickNames = (p: Picks) => [...Object.values(p.funds), ...Object.values(p.insurance)].flat().map((x) => x.name);
