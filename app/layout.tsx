import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Paw Fighter II · Dora & Enzo',description:'An original arcade fighting game with Dora, Enzo, predator rivals, ICE agents and a Donald Trump caricature. Seven playable fighters and a six-rival arcade ladder.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
