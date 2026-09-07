import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Enzo and Dora Escapes from ICE',description:'Help Enzo and Dora solve their cage puzzles and sneak together past ICE patrols in an isometric 3D escape adventure.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
