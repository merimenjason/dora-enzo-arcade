import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'The Arcade After Dark · Dora & Enzo’s Arcade',
  description: 'Chapter One of a cabinet-hopping adventure. After closing time the Static is eating the arcade; Dora and Enzo hop into the cabinets (a candlelit castle, a sunken sea, a cloud fortress), earn a ping, a sweep and a gust that carry across every world, and face the Static giant in the hub.',
};
export default function AfterDarkLayout({ children }: { children: React.ReactNode }) { return children; }
