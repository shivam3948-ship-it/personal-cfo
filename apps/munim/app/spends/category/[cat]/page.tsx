'use client';
import { use } from 'react';
import Category from '@/screens/Category';
import { Screen } from '@/ui/Screen';

export default function Page({ params }: { params: Promise<{ cat: string }> }) {
  const { cat } = use(params);
  return <Screen C={Category} view="category" props={{ cat: decodeURIComponent(cat) }} />;
}
