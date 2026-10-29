// Usage event names, designed with each screen (D-031). Each comment lists the only props that event may carry.
export const EVENTS = {
  screen_viewed: 'screen_viewed',               // { screen }
  view_load_failed: 'view_load_failed',         // { screen }
  math_opened: 'math_opened',                   // { screen, figure }
  home_top_item_tapped: 'home_top_item_tapped', // { reason, position }
  home_call_started: 'home_call_started',       // {}
  home_tile_tapped: 'home_tile_tapped',         // { tile }
  credit_notify_tapped: 'credit_notify_tapped', // {} fake door: interest in the Credit tab
  cas_add_opened: 'cas_add_opened',             // {}
  cas_read: 'cas_read',                         // { result, funds } (never amounts or names)
  cas_deleted: 'cas_deleted',
  statement_read: 'statement_read',             // { format, ok, rows } (never amounts or descriptions)
  files_added: 'files_added',                   // { files, bank, cas, sms, unknown, skipped } one upload of several files (counts only)
  statement_deleted: 'statement_deleted',                   // {}
  ask_opened: 'ask_opened',                     // { ctx } (D-042: is Ask found from sub-screens?)
  voice_started: 'voice_started',               // { ctx, mode }
  answer_listened: 'answer_listened',           // { ctx, how: tap | auto }
  onboarding_opened: 'onboarding_opened',       // { again } (D-049)
  onboarding_lang: 'onboarding_lang',           // { lang }
  onboarding_start: 'onboarding_start',         // { start: mine | sample }
  onboarding_name: 'onboarding_name',           // { given } (never the name)
  onboarding_add: 'onboarding_add',             // { kind: statement | cas }
  onboarding_later: 'onboarding_later',         // {}
  you_changed: 'you_changed',                   // { what, value } a setting on the You page (29 Oct)
  switched_to_sample: 'switched_to_sample',     // {}
  sample_bar_add_tapped: 'sample_bar_add_tapped', // {}
  sub_answered: 'sub_answered',                 // { answer } (never the merchant) (D-052)
  ask_sent: 'ask_sent',                         // { ctx, turn, via } (never the question text)
  sms_read: 'sms_read',                         // { messages, rows, added, otp, unreadable } (never text, amounts or names) (D-055)
  sms_deleted: 'sms_deleted',                   // {}
  fake_door_shown: 'fake_door_shown',           // { feature } a "coming soon" sheet opened (D-063)
  fake_door_notify_tapped: 'fake_door_notify_tapped', // { feature } "tell me when it's ready" (D-063)
} as const;
export type EventName = keyof typeof EVENTS;

/** The only props each event may carry, and what kind of value (D-057). Anything else is dropped on the phone and again
 *  on the server, so a new field can't slip personal data out without a change here.
 *  num / bool: numbers and booleans · token: a lowercase id-like word (screen, tool, model) · [..]: one of these values. */
export type PropKind = 'num' | 'bool' | 'token' | readonly string[];
const CTX = ['xray', 'invest', 'spends', 'credit', 'today'] as const;
const FEATURES = ['autopay', 'save_once', 'topup', 'save_now', 'bill_pay', 'card_extra', 'goals', 'fire', 'insurance', 'family'] as const;
export const PROPS: Record<EventName | 'answer' | 'feedback' | 'voice_turn', Record<string, PropKind>> = {
  screen_viewed: { screen: 'token' }, view_load_failed: { screen: 'token' }, math_opened: { screen: 'token', figure: 'token' },
  home_top_item_tapped: { reason: 'token', position: 'num' }, home_call_started: {}, home_tile_tapped: { tile: 'token' }, credit_notify_tapped: {},
  cas_add_opened: {}, cas_read: { result: ['summary', 'partial', 'unknown', 'mismatch', 'done', 'unreadable', 'unrecognised', 'wrong_password', 'needs_password', 'older'], funds: 'num' }, cas_deleted: {},
  statement_read: { format: 'token', ok: 'bool', rows: 'num' }, statement_deleted: {},
  files_added: { files: 'num', bank: 'num', cas: 'num', sms: 'num', unknown: 'num', skipped: 'num' },
  ask_opened: { ctx: CTX }, voice_started: { ctx: CTX, mode: ['server', 'browser'] },
  answer_listened: { ctx: CTX, how: ['tap', 'auto'], pieces: 'num', voice: ['sarvam', 'browser', 'none'], first_ms: 'num' },
  onboarding_opened: { again: 'bool' }, onboarding_lang: { lang: ['hi', 'en'] }, onboarding_start: { start: ['mine', 'sample'] }, onboarding_name: { given: 'bool' },
  onboarding_add: { kind: ['statement', 'cas'] }, onboarding_later: {}, you_changed: { what: ['lang', 'theme', 'start'], value: ['hi', 'en', 'auto', 'light', 'dark', 'mine', 'sample'] }, switched_to_sample: {}, sample_bar_add_tapped: {},
  sub_answered: { answer: ['yes', 'no', 'later'] }, ask_sent: { ctx: CTX, turn: 'num', via: ['text', 'voice'] },
  sms_read: { messages: 'num', rows: 'num', added: 'num', otp: 'num', unreadable: 'num' }, sms_deleted: {},
  fake_door_shown: { feature: FEATURES, first: 'bool' }, fake_door_notify_tapped: { feature: FEATURES },
  answer: { id: 'token', engine: ['claude', 'offline'], model: 'token', prompt: 'token', tools: 'token', steps: 'num', ms: 'num', grounded: 'bool', checked: 'num', unverified: 'num',
    lang: ['hi', 'en'], data: ['sample', 'mine'], where: ['server', 'phone', 'phone+relay'], fallback: 'bool', repaired: 'bool',
    guard: ['ai', 'rules', 'rules_fallback', 'none'], guard_ms: 'num' }, // which advice check ran (D-069) and how long it took
  feedback: { id: 'token', vote: ['up', 'down'], reason: ['wrong_number', 'not_answered', 'hard_to_follow'], data: ['sample', 'mine'] },
  voice_turn: { id: 'token', stt: ['server', 'browser', 'none'], stt_ms: 'num', agent_ms: 'num', speak_ms: 'num', total_ms: 'num', voice: ['sarvam', 'browser', 'none'], pieces: 'num', lang: ['hi', 'en'], data: ['sample', 'mine'] },
};
