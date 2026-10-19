// View models: exactly what each screen needs, computed on the server from @munim/core. No maths in components.
import type { Figure } from '../figure';

export type Tone = 'neutral' | 'bad' | 'good';
export interface TopItem { id: string; title: string; sub: string; amount: string; tone: Tone; href: string; reason: 'due' | 'leak' | 'fees' }
export interface Tile { label: string; value: string; delta?: { text: string; tone: Tone }; href: string; empty?: boolean }

export interface HomeView {
  asOf: string;
  dateLabel: string;          // "Thursday, 15 Oct"
  greeting: string;           // "Namaste, Rohan"
  memberLabel: string;
  isSample: boolean;
  netWorth: { total: Figure; investments: Figure; bank: Figure; loans: Figure; notIncluded: string } | null;
  top: TopItem[];             // at most 3, due first, then by rupee impact per year
  tiles: Tile[];              // loans, insurance, credit, subscriptions
}

export interface ViewMap { home: HomeView }
export type ScreenKey = keyof ViewMap;
