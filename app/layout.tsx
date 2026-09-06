import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Chin x Pit · Pawprint Grand Prix',description:'Race Dora and Enzo together in a kart through Dust Valley, with predator rivals, drift boosts and chinchilla-themed items.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
