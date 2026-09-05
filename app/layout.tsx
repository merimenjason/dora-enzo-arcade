import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'ChinChin · Dustbound',description:'An isometric action adventure with two fluffy chinchillas, procedural dungeons, leveling, branching skill trees, and companion combat.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
