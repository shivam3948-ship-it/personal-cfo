'use client';
import Xray from '@/screens/Xray';
import { Screen } from '@/ui/Screen';
import { withMyCasXray } from '@/lib/local/patch';

export default function Page() { return <Screen C={Xray} view="xray" patch={withMyCasXray} />; }
