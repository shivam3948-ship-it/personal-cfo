'use client';
// Runtime for screens compiled from the design canvas (tools/dc2react.py).
// A design's logic is a small class (state + renderVals); useDC keeps one instance per mounted screen and re-renders on setState.
import { useReducer, useRef } from 'react';

export class DCLogic {
  constructor(props) { this.props = props; this.state = {}; }
  setState() {}
}

export function useDC(C, props) {
  const ref = useRef(null);
  const [, force] = useReducer((x) => x + 1, 0);
  if (!ref.current) {
    const inst = new C(props);
    inst.setState = (patch) => {
      const next = typeof patch === 'function' ? patch(inst.state, inst.props) : patch;
      inst.state = { ...inst.state, ...next };
      force();
    };
    ref.current = inst;
  }
  ref.current.props = props;
  return ref.current.renderVals();
}

// Board file names in the designs -> app routes.
export const CATEGORY = { Food: 'Food delivery', Dining: 'Dining', Quick: 'Quick commerce', Shopping: 'Shopping', Cabs: 'Cabs', Fuel: 'Fuel', Utilities: 'Utilities', Mobile: 'Mobile & internet', Cash: 'Cash withdrawal', Fitness: 'Fitness' };
const ROUTES = { Main: '/', Invest: '/invest', Xray: '/invest/xray', Spends: '/spends', Transactions: '/spends/transactions', Rules: '/spends/rules', Credit: '/credit', Voice: '/ask', SundayCall: '/today/sunday', Recaps: '/today/recaps', MonthClose: '/today/month' };

export function route(href) {
  if (typeof href !== 'string') return '#';
  const m = href.match(/^([A-Za-z0-9]+)\.dc\.html(#.*)?$/);
  if (!m) return href;
  const name = m[1];
  if (name.startsWith('Category')) return '/spends/category/' + encodeURIComponent(CATEGORY[name.slice(8)] ?? name.slice(8));
  return (ROUTES[name] ?? '/') + (m[2] ?? '');
}
