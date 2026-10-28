// SERVER ONLY. Specific funds and insurance products Munim may name to BUY, only in private advice mode (D-066). Chosen and
// dated by the owner, never by the model: Ask reads them through the advice_picks tool and may not name anything that isn't
// here (the answer guard removes any product the user doesn't hold and isn't listed, lib/agent/brands.ts).
// Empty on purpose: until a pick is added for a need, Munim gives the category and says no pick is set up yet.
// Each pick: why it was chosen, where that came from, and the date it was last checked (picks go stale; recheck quarterly).
// Never import this from lib/agent, lib/local, ui or screens (a test checks): they run on the phone.
import type { Picks } from '@/lib/advicePicks';

export const PICKS: Picks = {
  funds: { liquid: [], short_term_debt: [], hybrid_multi_asset: [], index_large_cap: [], flexi_cap: [], elss: [] },
  insurance: { term: [], health: [] },
};
