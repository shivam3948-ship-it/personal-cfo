'use client';
import Credit from '@/screens/Credit';
import { Screen } from '@/ui/Screen';
import { track } from '@/lib/analytics';
import { withMyStatementsCredit } from '@/lib/local/patch';
import { trySample } from '@/ui/trySample';

// The Credit tab (D-094): what you owe, what's due, each card and loan. The credit-report reader is still a fake door: its tap is counted.
export default function Page() { return <Screen C={Credit} view="credit" patch={withMyStatementsCredit} props={{ onNotify: () => track('credit_notify_tapped'), onTrySample: trySample }} />; }
