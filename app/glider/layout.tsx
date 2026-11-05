import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Paperwing Post · Dora & Enzo’s Arcade', description: 'A 3D paper-glider game. Dora flies a big paper glider out of the attic window and over a storybook town while Enzo posts the letters through people’s windows: ride the warm air over the chimneys, catch the loose pages to fold new gliders, and glide home before sunset. A second player can take Enzo’s post button.' };
export default function GliderLayout({ children }: { children: React.ReactNode }) { return children; }
