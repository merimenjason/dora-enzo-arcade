import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Whisker Ware · Dora & Enzo’s Arcade',
  description: 'Five-second microgames, one after another, faster and faster: four hosts, four bosses and an endless Remix.',
};

export default function WhiskerWareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
