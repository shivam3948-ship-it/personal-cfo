'use client';
import Credit from '@/screens/Credit';
import { Screen } from '@/ui/Screen';
import { track } from '@/lib/analytics';

// Fake door until the Credit tab is built: "coming soon" plus a notify tap we can count.
export default function Page() { return <Screen C={Credit} props={{ onNotify: () => track('credit_notify_tapped') }} />; }
