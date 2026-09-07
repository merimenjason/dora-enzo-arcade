// Brief synthesized cues, enabled only after an explicit user gesture.
export class EscapeSound {
 context:AudioContext|null=null;
 enabled=false;
 async toggle(){this.enabled=!this.enabled;if(this.enabled){this.context??=new AudioContext();await this.context.resume();this.play('switch')}return this.enabled}
 play(kind:'switch'|'jump'|'interact'|'bath') {if(!this.enabled||!this.context||this.context.state!=='running')return;const ctx=this.context,at=ctx.currentTime;for(let i=0;i<(kind==='interact'?3:2);i++){const o=ctx.createOscillator(),gain=ctx.createGain(),start=at+i*.085;o.type='sine';const pitch=kind==='bath'?340:kind==='jump'?650:1000;o.frequency.setValueAtTime(pitch+i*140,start);o.frequency.exponentialRampToValueAtTime(pitch*.65,start+.09);gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.035,start+.015);gain.gain.exponentialRampToValueAtTime(.0001,start+.12);o.connect(gain);gain.connect(ctx.destination);o.start(start);o.stop(start+.13);o.onended=()=>{o.disconnect();gain.disconnect()}}}
 dispose(){void this.context?.close();this.context=null}
}
