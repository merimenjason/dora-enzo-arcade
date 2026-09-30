import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: "Chinchilla Scribble · Dora & Enzo's Arcade",
  description:
    'A Scribblenauts-style word puzzler: write a word, it appears, and Dora and Enzo use it to reach the golden wolfberry. Over 170 things, 47 adjectives that stack, 12 levels across three worlds and a sandbox. Local saves.',
};
export default function ScribbleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
