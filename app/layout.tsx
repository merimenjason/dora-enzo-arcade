import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Chin x Pit · Fluffball Cup',description:'Dora and Enzo captain opposing chinchilla soccer teams. Pass, shoot, sprint and compete in a ninety-second Fluffball Cup match.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
