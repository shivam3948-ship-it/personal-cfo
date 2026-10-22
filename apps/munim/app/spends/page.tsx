'use client';
import Spends from '@/screens/Spends';
import { Screen } from '@/ui/Screen';
import { withMyStatementsSpends } from '@/lib/local/patch';

export default function Page() { return <Screen C={Spends} view="spends" patch={withMyStatementsSpends} />; }
