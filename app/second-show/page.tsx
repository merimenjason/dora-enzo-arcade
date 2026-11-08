'use client';
import Cabinet from '../arcade-originals/cabinet';
import { secondShow } from '../../lib/second-show-game';
import { loadSecondShowScene } from '../../lib/second-show-scene';
export default function Page(){return <Cabinet rules={secondShow} loadArt={loadSecondShowScene} debugName="__secondShow" />;}
