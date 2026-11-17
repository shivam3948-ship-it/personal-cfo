// Usage events (D-031, D-057). Each goes to window.__munimEvents (tests and demos read it), to the console in development,
// and through telemetry.send(), which strips anything personal and sends only when a store is configured.
import { EVENTS, type EventName } from './eventNames';
import { send } from './telemetry';
export { EVENTS, type EventName };
type Props = Record<string, string | number | boolean>;

declare global { interface Window { __munimEvents?: { name: EventName; props: Props; at: number }[] } }

export function track(name: EventName, props: Props = {}): void {
  if (typeof window === 'undefined') return;
  (window.__munimEvents ??= []).push({ name, props, at: Date.now() });
  if (process.env.NODE_ENV !== 'production') console.debug('[track]', name, props);
  send(name, props);
}
