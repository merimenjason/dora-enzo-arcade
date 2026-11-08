'use client';
import Cabinet from '../arcade-originals/cabinet';
import { nightWire } from '../../lib/night-wire-game';
import { loadNightWireScene } from '../../lib/night-wire-scene';
export default function Page(){return <Cabinet rules={nightWire} loadArt={loadNightWireScene} debugName="__nightWire" />;}
