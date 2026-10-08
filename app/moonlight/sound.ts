import { makeSound } from '../../lib/cue-sound';
export const sound=makeSound('moonlight-mischief-sound-v1',{
  treat:[{f:784,d:.1,v:.02},{f:1047,d:.15,at:.09,v:.018}],
  rescue:[{f:523,d:.1,v:.025},{f:659,d:.12,at:.1,v:.02},{f:784,d:.18,at:.2,v:.02}],
  dust:[{f:1100,d:.16,noise:true,v:.01}],hide:[{f:280,to:220,d:.1,v:.015}],
  dash:[{f:800,to:1400,d:.12,noise:true,v:.012}],distract:[{f:650,d:.15,noise:true,v:.025}],
  push:[{f:130,d:.16,noise:true,v:.025}],gap:[{f:420,to:650,d:.1,v:.018}],
  caught:[{f:262,d:.2,v:.03},{f:196,d:.25,at:.18,v:.025}],home:[{f:659,d:.16,v:.018}],
  won:[{f:523,d:.15,v:.025},{f:659,d:.15,at:.15,v:.025},{f:784,d:.3,at:.3,v:.025}],
  lost:[{f:330,to:165,d:.4,type:'triangle',v:.025}],
});
