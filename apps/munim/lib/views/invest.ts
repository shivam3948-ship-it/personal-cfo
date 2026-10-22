import type { Dataset } from '@core/types';
import design from '../../designs/design-data.json';
// TEMP: design sample data until the engine-computed view lands (same shapes).
export const buildInvest = (_ds: Dataset) => design.Invest as Record<string, unknown>;
export const buildXray = (_ds: Dataset) => design.Xray as Record<string, unknown>;
