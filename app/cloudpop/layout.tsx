import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Cloudpop · Dora & Enzo’s Arcade',
  description: 'A tower-defence game of popping storm-puffs. Layered clouds drift down an Andean valley to rain out the harvest festival; Dora, Enzo and the chinchilla crew pop them layer by layer with slingers, buskers, ember pots, llamas, hay-bale cannons, condors and more. Eleven towers with three upgrade paths each, eight painted maps, three difficulties and their modes, Thunderhead bosses, and Burrow Lore, the Tower Lab, medals, trophies and a daily challenge between runs.',
};
export default function CloudpopLayout({ children }: { children: React.ReactNode }) { return children; }
