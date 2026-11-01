import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Shadowplay · Dora & Enzo’s Arcade', description: 'A shadow-puppet theatre puzzle. Hang lace-cut puppets between the lantern and the paper screen, turn, flip and slide them near and far until their shadows make the picture, and watch each scene come alive. Five stories, thirty scenes, coloured glass and two-coloured lanterns, three stars a scene and a free stage.' };
export default function ShadowLayout({ children }: { children: React.ReactNode }) { return children; }
