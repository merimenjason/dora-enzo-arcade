import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:"Dora & Enzo's Arcade",description:'Eleven original browser games starring Dora and Enzo the chinchillas: a fighting game with predator rivals and ICE agents, two editions of the Dust & Documents border-inspection game, the Chin x Pit ball-bouncing classic, Night Survivors, an action RPG, stealth, racing, soccer an arcade flyer and Dust Bath Dash, a cozy chinchilla spa.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
