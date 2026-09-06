import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Chin x Pit',description:'Dora and Enzo survive predator swarms with chinchilla-themed automatic weapons, collectible XP, and evolutions.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
