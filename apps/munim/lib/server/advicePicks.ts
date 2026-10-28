// SERVER ONLY. Specific funds and insurance products Munim may name to BUY, only in private advice mode (D-066). Chosen and
// dated by the owner, never by the model: Ask reads them through the advice_picks tool and may not name anything that isn't
// here (the answer guard removes any product the user doesn't hold and isn't listed, lib/agent/brands.ts).
// Empty on purpose: until a pick is added for a need, Munim gives the category and says no pick is set up yet.
// Each pick: why it was chosen, where that came from, and the date it was last checked (picks go stale; recheck quarterly).
// Server code only: app/api/*, lib/agent/index.ts (the server's Ask) and evals. Never from anything the phone runs (lib/local,
// ui, screens, app pages, or lib/agent/claude.ts and tools.ts, which the phone also runs); tests/advice-review-fixes.test.ts
// walks the phone's imports to check.
import type { Picks } from '@/lib/advicePicks';

export const PICKS: Picks = {
  funds: { liquid: [], short_term_debt: [], hybrid_multi_asset: [], index_large_cap: [], flexi_cap: [], elss: [] },
  insurance: { term: [], health: [] },
};
