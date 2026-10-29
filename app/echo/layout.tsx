import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Echo Burrow · Dora & Enzo’s Arcade', description: 'A time-loop puzzle platformer for two chinchillas. One records a run while a candle burns, then time rewinds and the other plays beside a shimmering echo that repeats every move. Plates, crates, lifts, seesaws, fans, crumbling ledges and glow-moss across thirty burrow rooms on the way home.' };
export default function EchoLayout({ children }: { children: React.ReactNode }) { return children; }
