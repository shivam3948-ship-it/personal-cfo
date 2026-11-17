'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getProfile } from '@/lib/local/profile';
import { IconHome, IconInvest, IconMic, IconMoney, IconPlan } from './icons';

// The app's five tabs, as in the designs' nav (designs/Main.dc.html): English, or Hindi when the profile says so.
const ITEMS = [
  { href: '/', label: 'Today', hi: 'आज', Icon: IconHome, match: ['/', '/today'] },
  { href: '/invest', label: 'Invest', hi: 'निवेश', Icon: IconInvest, match: ['/invest'] },
  { href: '/ask', label: 'Ask Munim', hi: 'मुनीम से पूछें', Icon: IconMic, match: ['/ask'] },
  { href: '/spends', label: 'Spends', hi: 'खर्च', Icon: IconPlan, match: ['/spends'] },
  { href: '/credit', label: 'Credit', hi: 'उधार', Icon: IconMoney, match: ['/credit'] },
];

export function BottomNav() {
  const path = usePathname() ?? '/';
  const [hi, setHi] = useState(false);
  useEffect(() => { setHi(getProfile()?.lang === 'hi'); }, []); // the profile lives in this browser only (lib/local/profile.ts)
  const active = (m: string[]) => m.some((p) => (p === '/' ? path === '/' : path.startsWith(p)));
  return (
    <nav className="nav" aria-label={hi ? 'मुख्य' : 'Main'}>
      <ul>{ITEMS.map(({ href, label, hi: labelHi, Icon, match }) => (
        <li key={href}><Link href={href} aria-current={active(match) ? 'page' : undefined}><Icon />{hi ? labelHi : label}</Link></li>
      ))}</ul>
    </nav>
  );
}
