import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Pixel Smith · Dora & Enzo’s Arcade', description: 'A pixel-art action roguelite where Enzo draws Dora’s weapon pixel by pixel: its shape is its hitbox and its colours are its powers. Critters burst into the paint for the next one, and every pixel on the weapon is one that can’t patch up Dora’s fur.' };
export default function SmithLayout({ children }: { children: React.ReactNode }) { return children; }
