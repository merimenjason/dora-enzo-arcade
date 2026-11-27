import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Tambak · Dora & Enzo’s Arcade',
  description: 'An area-capture game in coloured sand on a lightbox. Dora and Enzo pour new land into the sea at six real Singapore reclamation sites, from East Coast Park to Tuas Port, while jellyfish, crocodiles and pufferfish try to wash their lines away.',
};
export default function TambakLayout({ children }: { children: React.ReactNode }) { return children; }
