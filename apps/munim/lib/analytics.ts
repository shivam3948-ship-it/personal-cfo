// Event names are designed with each screen; the provider is wired last (D-031). Until then events go to the console
// in development and to window.__munimEvents so tests and demos can read them.
export const EVENTS = {
  screen_viewed: 'screen_viewed',               // { screen }
  view_load_failed: 'view_load_failed',         // { screen }
  math_opened: 'math_opened',                   // { screen, figure }
  home_top_item_tapped: 'home_top_item_tapped', // { reason, position }
  home_call_started: 'home_call_started',       // {}
  home_tile_tapped: 'home_tile_tapped',         // { tile }
  credit_notify_tapped: 'credit_notify_tapped', // {} fake door: interest in the Credit tab
  ask_opened: 'ask_opened',                     // { ctx } (D-042: is Ask found from sub-screens?)
  voice_started: 'voice_started',               // { ctx, mode }
  answer_listened: 'answer_listened',           // { ctx, how: tap | auto }
  ask_sent: 'ask_sent',                         // { ctx, turn } (never the question text)
} as const;
export type EventName = keyof typeof EVENTS;
type Props = Record<string, string | number | boolean>;

declare global { interface Window { __munimEvents?: { name: EventName; props: Props; at: number }[] } }

export function track(name: EventName, props: Props = {}): void {
  if (typeof window === 'undefined') return;
  (window.__munimEvents ??= []).push({ name, props, at: Date.now() });
  if (process.env.NODE_ENV !== 'production') console.debug('[track]', name, props);
}
