import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Highburrow · Dora & Enzo’s Arcade',
  description: 'A gentle turn-based settlement game up an Andean valley. Dora scouts the mist and Enzo founds burrow-villages; settlers work the fields, llama caravans carry goods on standing routes, and friendships with the vicuña herders, the condors and the viscachas teach new skills. Keep every village warm through frost nights and hold the summit festival before turn 60.',
};
export default function HighburrowLayout({ children }: { children: React.ReactNode }) { return children; }
