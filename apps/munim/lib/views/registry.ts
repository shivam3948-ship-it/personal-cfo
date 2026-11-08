import type { Dataset } from '@core/types';
import type { Session } from '../session';
import type { ScreenKey, ViewMap } from './types';
import { buildHome } from './home';
import { buildToday } from './today';
import { buildSpendsMain } from './spendsMain';
import { buildInvest, buildXray } from './invest';
import { buildTransactions, buildCategory } from './spends';
import { buildCredit } from './credit';

type Builder<K extends ScreenKey> = (ds: Dataset, s: Session) => ViewMap[K];
export const VIEWS: { [K in ScreenKey]: Builder<K> } = { home: buildHome, today: buildToday, spends: (ds) => buildSpendsMain(ds), invest: buildInvest, xray: buildXray, transactions: buildTransactions, category: buildCategory, credit: (ds) => buildCredit(ds) };
export const isScreen = (x: string): x is ScreenKey => x in VIEWS;
