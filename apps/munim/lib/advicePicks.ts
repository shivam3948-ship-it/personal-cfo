// Specific funds and insurance products Munim may name to BUY, only in private advice mode (D-066). Chosen and dated by the
// owner, never by the model: Ask reads them through the advice_picks tool and may not name anything that isn't here.
// Empty on purpose: until a pick is added for a need, Munim gives the category and says no pick is set up yet.
// Each pick: why it was chosen, where that came from, and the date it was last checked (picks go stale; recheck quarterly).
export interface Pick { name: string; why: string; source: string; checkedOn: string }
export const PICKS: { funds: Record<'liquid' | 'short_term_debt' | 'hybrid_multi_asset' | 'index_large_cap' | 'flexi_cap' | 'elss', Pick[]>; insurance: Record<'term' | 'health', Pick[]> } = {
  funds: { liquid: [], short_term_debt: [], hybrid_multi_asset: [], index_large_cap: [], flexi_cap: [], elss: [] },
  insurance: { term: [], health: [] },
};
