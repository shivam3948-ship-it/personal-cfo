// "Coming soon" doors record intent (D-063): kept on the phone, and only the feature name leaves as a usage event.
import { describe, expect, it } from 'vitest';
import { FEATURE, loadIntents, notifiedSheets, recordIntent } from '@/lib/local/intents';
import { propsFor } from '@/lib/telemetryCore';

describe('intents', () => {
  it('counts opens and remembers the first "tell me"', async () => {
    await recordIntent('tool_goals', 'opened'); await recordIntent('tool_goals', 'opened');
    const a = await recordIntent('tool_goals', 'notify'); const first = a.tool_goals.notifyAt;
    const b = await recordIntent('tool_goals', 'notify');
    expect(b.tool_goals).toMatchObject({ opened: 2, notifyAt: first });
    expect(notifiedSheets(await loadIntents())).toEqual({ tool_goals: true });
  });
  it('every door has a feature name the event guard accepts, and nothing else gets through', () => {
    for (const f of Object.values(FEATURE)) expect(propsFor('fake_door_notify_tapped', { feature: f })).toEqual({ feature: f });
    expect(propsFor('fake_door_shown', { feature: 'goals', first: true, amount: 5000, goal: 'phone' })).toEqual({ feature: 'goals', first: true });
  });
});
