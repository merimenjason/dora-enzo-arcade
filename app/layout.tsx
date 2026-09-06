import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Chin x Pit · Border Hop',description:'Flap through a desert border-crossing adventure with Dora and Enzo. Clear 20 checkpoints together to reach the USA welcome gate.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
