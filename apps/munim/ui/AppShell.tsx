import { BottomNav } from './BottomNav';

export function AppShell({ children }: { children: React.ReactNode }) {
  return <div className="shell"><main className="screen">{children}</main><BottomNav /></div>;
}
