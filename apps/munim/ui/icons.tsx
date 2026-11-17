const P = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
export const IconHome = () => <svg {...P}><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /></svg>;
export const IconMoney = () => <svg {...P}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></svg>;
export const IconInvest = () => <svg {...P}><path d="M4 19V5" /><path d="M4 19h16" /><path d="m7 14 4-4 3 3 5-6" /></svg>;
export const IconPlan = () => <svg {...P}><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17" /></svg>;
export const IconMic = ({ size = 22, color = 'currentColor' }: { size?: number; color?: string }) => <svg {...P} width={size} height={size} stroke={color}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>;
