import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'The Clocktower Mystery · Dora & Enzo’s Arcade', description: 'A painted point-and-click adventure. The town clock has stopped the night before the Winter Fair and four of its wheels are missing: play as Dora, who climbs, and Enzo, who listens, talk to the townsfolk, gather clues and mend the clock before eight o’clock.' };
export default function ClocktowerLayout({ children }: { children: React.ReactNode }) { return children; }
