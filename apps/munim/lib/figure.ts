// A number on screen, with the working behind it. Screens render `text`; `math` powers "Show the math".
export interface Math { formula: string; parts: { label: string; text: string }[]; sources: string[]; asOf?: string }
export interface Figure { text: string; paise: number | null; math?: Math }

export const fig = (text: string, paise: number | null, math?: Math): Figure => ({ text, paise, ...(math ? { math } : {}) });
