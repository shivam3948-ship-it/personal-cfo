'use client';
import Invest from '@/screens/Invest';
import { Screen } from '@/ui/Screen';
import { withMyCasInvest } from '@/lib/local/patch';

export default function Page() { return <Screen C={Invest} view="invest" patch={withMyCasInvest} />; }
