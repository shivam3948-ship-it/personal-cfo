import type { Dataset } from '@core/types';
import type { Session } from '../session';
import type { ScreenKey, ViewMap } from './types';
import { buildHome } from './home';

type Builder<K extends ScreenKey> = (ds: Dataset, s: Session) => ViewMap[K];
export const VIEWS: { [K in ScreenKey]: Builder<K> } = { home: buildHome };
export const isScreen = (x: string): x is ScreenKey => x in VIEWS;
