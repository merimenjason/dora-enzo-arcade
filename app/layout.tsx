import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'ChinChin · Dustbound',description:'An isometric action adventure with two fluffy chinchillas, click-to-move combat, loot, and shared abilities.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
