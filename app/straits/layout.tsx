import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Little Red Dot: The Straits · Dora & Enzo’s Arcade',
  description: 'The first voyage of an island-hopping sailing adventure. Sail a toy-sized bumboat between Singapore’s islands, outrun or sink the otter rafts, answer Captain Bishan at his kelong, and land the hay bale on Pulau Ubin.',
};
export default function StraitsLayout({ children }: { children: React.ReactNode }) { return children; }
