'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconHome, IconInvest, IconMic, IconMoney, IconPlan } from './icons';

const ITEMS = [
  { href: '/', label: 'Home', Icon: IconHome, match: ['/', '/loans', '/protect', '/credit', '/you'] },
  { href: '/money', label: 'Money', Icon: IconMoney, match: ['/money'] },
  { href: '/invest', label: 'Invest', Icon: IconInvest, match: ['/invest'] },
  { href: '/plan', label: 'Plan', Icon: IconPlan, match: ['/plan'] },
  { href: '/talk', label: 'Talk', Icon: IconMic, match: ['/talk'] },
];

export function BottomNav() {
  const path = usePathname() ?? '/';
  const active = (m: string[]) => m.some((p) => (p === '/' ? path === '/' || ['/loans', '/protect', '/credit', '/you'].some((x) => path.startsWith(x)) : path.startsWith(p)));
  return (
    <nav className="nav" aria-label="Main">
      <ul>{ITEMS.map(({ href, label, Icon, match }) => (
        <li key={href}><Link href={href} aria-current={active(match) ? 'page' : undefined}><Icon />{label}</Link></li>
      ))}</ul>
    </nav>
  );
}
