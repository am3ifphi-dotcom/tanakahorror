const FILES=['footstep_0','footstep_1','footstep_2','creak_1','creak_2','creak_3','door_open_1','door_close_1','book_open','book_flip_1','metal_latch','metal_click','cloth_1'];
export class Sound{
 constructor(){this.context=null;this.buffers={};this.volume=.55;this.muted=false;this.active=[];this.ready=false;this.room='foyer';}
 async init(){
  if(this.context){await this.context.resume();return;}
  this.context=new (window.AudioContext||window.webkitAudioContext)();
  this.master=this.context.createGain();this.master.gain.value=this.volume*.55;this.master.connect(this.context.destination);
  const results=await Promise.allSettled(FILES.map(async name=>{
   const res=await fetch(`/assets/audio/${name}.ogg`);if(!res.ok)throw new Error(name);
   this.buffers[name]=await this.context.decodeAudioData(await res.arrayBuffer());
  }));
  this.ready=true;this.failures=results.filter(r=>r.status==='rejected').length;
  await this.context.resume();return this.failures;
 }
 setVolume(volume,muted=false){this.volume=volume;this.muted=muted;if(this.context)this.master.gain.setTargetAtTime(muted?0:volume*.55,this.context.currentTime,.12);}
 play(name,{gain=.4,rate=1,pan=0,delay=0,filter=8000,loop=false}={}){
  if(!this.context||!this.buffers[name])return null;
  const s=this.context.createBufferSource(),g=this.context.createGain(),p=this.context.createStereoPanner(),f=this.context.createBiquadFilter();
  s.buffer=this.buffers[name];s.playbackRate.value=rate;s.loop=loop;g.gain.value=gain;p.pan.value=pan;f.type='lowpass';f.frequency.value=filter;
  s.connect(f);f.connect(g);g.connect(p);p.connect(this.master);s.start(this.context.currentTime+delay);
  s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();p.disconnect();};return {source:s,gain:g};
 }
 ambience(room){
  this.stopAmbient();this.room=room;
  // External wood creaks, time-stretched and filtered, form the room tone; no synthetic BGM.
  const source=this.play(room==='echo'?'creak_3':'creak_1',{gain:room==='echo'?.07:.045,rate:.17,loop:true,filter:420,pan:-.3});
  if(source)this.active.push(source);
 }
 stopAmbient(){for(const a of this.active){try{a.gain.gain.setTargetAtTime(0,this.context.currentTime,.25);a.source.stop(this.context.currentTime+1);}catch{}}this.active=[];}
 suspend(){if(this.context?.state==='running')this.context.suspend();}
 resume(){if(this.context?.state==='suspended')this.context.resume().catch(()=>{});}
 step(index,run=false){this.play(`footstep_${index%3}`,{gain:run?.27:.15,rate:run?.95:.74,pan:Math.sin(index)*.15,filter:1800});}
 distant(){this.play('creak_2',{gain:.14,rate:.58,pan:.8,filter:1000});}
 knock(){for(let i=0;i<3;i++)this.play('metal_click',{gain:.12,rate:.38,pan:-.75,delay:i===2?1.7:i*.48,filter:800});}
}
