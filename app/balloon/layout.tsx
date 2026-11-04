import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Cloudberry Balloon · Dora & Enzo’s Arcade', description: 'A side-on hot-air balloon game. Dora and Enzo fly Granny Bramble’s patchwork balloon across eight hops of a painted valley to the Lantern Festival: no steering, only the burner, the vent and winds that blow a different way at every height. Pick cloudberries, drop jars of jam to the gardens on parachutes, and land softly on the meadow.' };
export default function BalloonLayout({ children }: { children: React.ReactNode }) { return children; }
