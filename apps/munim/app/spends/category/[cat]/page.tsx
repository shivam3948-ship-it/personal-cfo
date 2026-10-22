'use client';
import { use } from 'react';
import Category from '@/screens/Category';
import { Screen } from '@/ui/Screen';
import { CATEGORY } from '@/ui/dc';

export default function Page({ params }: { params: Promise<{ cat: string }> }) {
  const raw = decodeURIComponent(use(params).cat);
  const cat = (CATEGORY as Record<string, string>)[raw] ?? raw; // short board names (/spends/category/Food) work too
  const check = (d: unknown) => ((d as { DATA?: Record<string, unknown> }).DATA?.[cat] ? null : `No spending category called “${raw}”.`);
  return <Screen C={Category} view="category" props={{ cat }} check={check} />;
}
