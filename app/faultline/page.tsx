'use client';
import Cabinet from '../arcade-originals/cabinet';
import { faultline } from '../../lib/faultline-game';
import { loadFaultlineScene } from '../../lib/faultline-scene';
export default function Page(){return <Cabinet rules={faultline} loadArt={loadFaultlineScene} debugName="__faultline" />;}
