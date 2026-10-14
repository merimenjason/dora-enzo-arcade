import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Ember & Clover: Midnight Kitchen · Dora & Enzo’s Arcade',
  description:
    'Whisk, bake and serve with Dora, Enzo, Pip and Ember through twelve moonlit kitchen shifts, or take your time in an untimed cozy bakery.',
};
export default function KitchenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
