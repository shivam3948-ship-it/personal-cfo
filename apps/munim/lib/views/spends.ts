import type { Dataset } from '@core/types';
import design from '../../designs/design-data.json';
// TEMP: design sample data until the engine-computed view lands (same shapes).
export const buildTransactions = (_ds: Dataset) => design.Transactions as Record<string, unknown>;
export const buildCategory = (_ds: Dataset) => design.Category as Record<string, unknown>;
