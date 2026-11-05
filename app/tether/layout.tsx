import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Tetherball · Dora & Enzo’s Arcade', description: 'A pixel-art action roguelite with no weapons. Dora hooks a Grumble on a rope, whirls it round and lets go, bowling it through the rest; heavy boars drag her about, and Enzo stands in every arena as a living anchor to swing round. Thirteen arenas, upgrades from Enzo’s satchel and a stone golem at the end.' };
export default function TetherLayout({ children }: { children: React.ReactNode }) { return children; }
