import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Chin x Pit Arcade · Dora & Enzo',description:'Eight original browser games starring Dora and Enzo the chinchillas: a fighting game with Dora, Enzo, predator rivals, ICE agents and a Donald Trump caricature. Seven playable fighters, a story mode, training mode and a Dust & Documents border-inspection game.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
