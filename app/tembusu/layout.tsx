import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Tembusu · Dora & Enzo’s Arcade', description: 'A calm pixel-art idle roguelite about one tembusu tree on a hill, from seed to fall. It grows by itself; now and then a branch offers three buds and you pick one. Animals move in, storms pass, and the seeds you keep become the next trees.' };
export default function TembusuLayout({ children }: { children: React.ReactNode }) { return children; }
