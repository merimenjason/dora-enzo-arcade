import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Chin x Pit Arcade · Dora & Enzo',description:'Ten original browser games starring Dora and Enzo the chinchillas: a fighting game with predator rivals and ICE agents, two editions of the Dust & Documents border-inspection game, the Chin x Pit ball-bouncing classic, Night Survivors, an action RPG, stealth, racing, soccer and an arcade flyer.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
