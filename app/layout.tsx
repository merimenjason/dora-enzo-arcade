import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Chin x Pit',description:'A chinchilla ball-bouncing roguelite with ricochets, elemental ball fusion, and advancing enemy waves.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
