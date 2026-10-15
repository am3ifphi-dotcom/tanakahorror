import {ROOMS,SPRITES,getHotspots} from './world.js';
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const rand=n=>{const a=Math.sin(n*127.1+311.7)*43758.5453;return a-Math.floor(a)};
// Sheet rows: 0 front (facing the player), 1 left, 2 right, 3 back. Unit vectors of where she faces.
const FACING=[[0,1],[-1,0],[1,0],[0,-1]];
// Where the torch hand sits in each drawing, in world pixels from the feet anchor.
// The sprite is drawn at 50x50 (5/6 of the 60px sheet), so these are the
// measured hand/lamp positions scaled accordingly: the side views hold the
// lamp out ahead on the supplied drawings' extended arm, the front view
// carries it one-handed just right of centre, and seen from behind the torch
// is in front of her body.
const TORCH_HAND=[[7,-17],[-12,-15],[12,-14],[0,-30]];
export class Renderer{
 constructor(canvas){
  this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.images={};this.cache={};this.cam={x:512,y:320};this.time=0;this.beam={x:0,y:1};this.resize();
  this.lightCanvas=document.createElement('canvas');this.lightCanvas.width=1024;this.lightCanvas.height=640;
  addEventListener('resize',()=>this.resize());
 }
 async load(){
  await Promise.all(['interiors','room-builder','girl-walk','girl','indoor','dungeon','sheet'].map(name=>new Promise((resolve,reject)=>{
   const im=new Image();im.onload=()=>{this.images[name]=im;resolve()};im.onerror=()=>reject(new Error(`素材を読み込めません: ${name}`));im.src=name==='girl-walk'?'/assets/character/girl-walk.svg?v=11':name==='girl'?'/assets/character/girl-front.png?v=11':`/assets/${name}.png`;
  })));
  // Color-grade once at load time, never in every animation frame.
  for(const name of ['interiors','room-builder','girl-walk']){
   const image=this.images[name],buffer=document.createElement('canvas');buffer.width=image.width;buffer.height=image.height;
   const b=buffer.getContext('2d');b.filter=name==='girl-walk'?'saturate(.58) brightness(.85)':'saturate(.38) brightness(.78)';b.drawImage(image,0,0);this.images[name]=buffer;
  }
  this.shadowSprites={};
  for(const [name,a] of Object.entries(SPRITES)){
   const buffer=document.createElement('canvas');buffer.width=a[2]*32;buffer.height=a[3]*32;const b=buffer.getContext('2d');
   b.drawImage(this.images.interiors,a[0]*32,a[1]*32,a[2]*32,a[3]*32,0,0,buffer.width,buffer.height);
   b.globalCompositeOperation='source-in';b.fillStyle='#020609';b.fillRect(0,0,buffer.width,buffer.height);this.shadowSprites[name]=buffer;
  }
  const ghost=document.createElement('canvas');ghost.width=60;ghost.height=60;const gc=ghost.getContext('2d');gc.drawImage(this.images.girl,0,0);gc.globalCompositeOperation='source-in';gc.fillStyle='#090b10';gc.fillRect(0,0,60,60);this.images['girl-shadow']=ghost;
  for(const name of Object.keys(ROOMS))this.cache[name]=this.buildRoom(name);
 }
 resize(){
  // A low-resolution backing buffer is intentional: real nearest-neighbour pixel art.
  this.scale=Math.max(.6,innerHeight/640);this.width=Math.ceil(innerWidth/this.scale);this.height=Math.ceil(innerHeight/this.scale);
  this.canvas.width=this.width;this.canvas.height=this.height;this.ctx.imageSmoothingEnabled=false;
 }
 tile(c,img,sx,sy,sw,sh,x,y,w=sw,h=sh){c.drawImage(this.images[img],sx,sy,sw,sh,Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
 sprite(c,name,x,y,scale=1,shadow=false){const a=SPRITES[name];if(shadow){c.drawImage(this.shadowSprites[name],x,y,a[2]*32*scale,a[3]*32*scale);return;}this.tile(c,'interiors',a[0]*32,a[1]*32,a[2]*32,a[3]*32,x,y,a[2]*32*scale,a[3]*32*scale);}
 buildRoom(name){
  const room=ROOMS[name],bg=document.createElement('canvas');bg.width=1024;bg.height=640;
  const c=bg.getContext('2d');c.imageSmoothingEnabled=false;
  const [l,t,r,b]=room.bounds,wallTop=115;
  c.fillStyle='#081214';c.fillRect(0,0,1024,640);
  // Masonry, wallpaper, herringbone floors and furniture are assembled from licensed sheets.
  // Tile choices are measured for edge luminance so repeats never show a seam:
  // the herringbone uses the one seamless column (13) with the two rows
  // alternating vertically, and the stone floor stacks row 10 over row 9.
  c.save();
  for(let y=t;y<b;y+=32)for(let x=l;x<r;x+=32){
   const phase=Math.floor((y-t)/32)%2;
   const row=room.floor==='wood'?(phase?14:13):(phase?9:10),col=room.floor==='wood'?13:11;
   this.tile(c,'room-builder',col*32,row*32,32,32,x,y,32,32);
  }
  for(let x=l;x<r;x+=32){
   // Wall column 1 is the seamless repeat for every wall style (col 3 draws
   // a frame line every tile); the baseboard strip uses col 3, which repeats
   // without the faint joint column 1 shows.
   this.tile(c,'room-builder',32,room.wall*32,32,64,x,wallTop,32,96);
   this.tile(c,'room-builder',3*32,13*32,32,64,x,wallTop+89,32,44);
  }
  c.restore();
  // Deep mouldings create a dollhouse cutaway, rather than flat map boundaries.
  c.fillStyle='#102023';c.fillRect(l-20,wallTop-22,r-l+40,24);c.fillRect(l-20,wallTop,20,b-wallTop+20);c.fillRect(r,wallTop,20,b-wallTop+20);
  c.fillStyle='#34403c';c.fillRect(l-8,wallTop-5,r-l+16,4);c.fillRect(l-4,wallTop+128,r-l+8,3);
  c.fillStyle='#0a1719';c.fillRect(l,t-2,r-l,5);c.fillRect(l-20,b,r-l+40,22);
  c.fillStyle='#50605955';c.fillRect(l-16,wallTop,2,b-wallTop);c.fillRect(r+2,wallTop,2,b-wallTop);c.fillRect(l,b+1,r-l,2);
  const floorShade=c.createLinearGradient(0,t,0,t+60);floorShade.addColorStop(0,'#030c1199');floorShade.addColorStop(1,'#030c1100');c.fillStyle=floorShade;c.fillRect(l,t,r-l,60);
  c.save();c.beginPath();c.rect(l,t,r-l,b-t);c.clip();
  // Wear and subtle dust marks are compositing effects, not a replacement tileset.
  for(let i=0;i<140;i++){
   const x=l+rand(i+2)*(r-l),y=t+rand(i+433)*(b-t);c.fillStyle=i%3?'#08101419':'#b7bca813';c.fillRect(Math.floor(x/2)*2,Math.floor(y/2)*2,2+Math.floor(rand(i)*15)*2,2);
  }
  if(room.rug){this.sprite(c,room.rug.sprite,room.rug.x,room.rug.y,room.rug.scale);}
  c.restore();
  // Window pools extend across floor, with the mullion cutting the light.
  for(const p of room.props.filter(p=>p.sprite==='window')){
   const x=p.x+16,y=228;
   c.save();c.globalCompositeOperation='screen';
   const g=c.createLinearGradient(x,y,x+30,500);g.addColorStop(0,'#6ea1a831');g.addColorStop(1,'#366a7100');c.fillStyle=g;
   c.beginPath();c.moveTo(x,y);c.lineTo(x+52,y);c.lineTo(x+160,499);c.lineTo(x+22,499);c.closePath();c.fill();
   c.fillStyle='#020d0f77';c.beginPath();c.moveTo(x+24,y);c.lineTo(x+28,y);c.lineTo(x+92,499);c.lineTo(x+80,499);c.closePath();c.fill();c.restore();
  }
  for(const door of room.doors)if(!door.hidden)this.drawDoor(c,door,false);
  if(name==='hall'){
   // The stopped clock is an original puzzle overlay on an external wood cabinet.
   c.fillStyle='#141918';c.fillRect(391,147,42,61);c.fillStyle='#777863';c.fillRect(393,148,38,2);
   c.fillStyle='#b4b29b';c.beginPath();c.arc(412,171,15,0,Math.PI*2);c.fill();c.strokeStyle='#4c5348';c.lineWidth=2;
   c.beginPath();c.moveTo(412,171);c.lineTo(421,166);c.moveTo(412,171);c.lineTo(424,174);c.stroke();c.fillStyle='#656d59';c.fillRect(410,190,4,10);
  }
  // Uneven upper and lower foreground silhouettes frame the inhabited space.
  c.fillStyle='#071012';c.fillRect(l-20,87,150,22);c.fillRect(r-115,85,137,24);
  c.fillStyle='#0e1b1c';c.fillRect(l+10,99,2,12);c.fillRect(r-11,96,2,13);
  return bg;
 }
 drawDoor(c,door,open){
  c.save();
  if(door.side==='top'){
   c.fillStyle='#081014';c.fillRect(door.x-36,139,72,110);
   if(!open)this.sprite(c,'door',door.x-32,146,1);
   c.fillStyle='#53605a';c.fillRect(door.x-36,138,72,4);c.fillRect(door.x-36,138,4,110);c.fillRect(door.x+32,138,4,110);
   c.fillStyle='#7f846144';c.fillRect(door.x-31,246,62,3);
  }else if(door.side==='bottom'){
   c.fillStyle='#151c1b';c.fillRect(door.x-39,548,78,36);c.fillStyle='#8b89745d';c.fillRect(door.x-35,552,70,4);
   c.fillStyle='#050b0d';c.fillRect(door.x-32,561,64,32);
  }else{
   const x=door.x-13;c.fillStyle='#070e10';c.fillRect(x,door.y-69,26,96);c.fillStyle='#5e5a48';c.fillRect(x-3,door.y-75,32,5);c.fillRect(x-3,door.y-75,4,110);c.fillRect(x+25,door.y-75,4,110);
   c.fillStyle='#66614d';c.fillRect(x+5,door.y-63,14,86);c.fillStyle='#99936b';c.fillRect(x+9,door.y-15,3,4);
  }c.restore();
 }
 screenToWorld(clientX,clientY){const rect=this.canvas.getBoundingClientRect();return {x:(clientX-rect.left)/rect.width*this.width-this.offsetX,y:(clientY-rect.top)/rect.height*this.height-this.offsetY};}
 draw(state,view,dt){
  if(!this.cache.foyer)return;
  this.time+=dt;const c=this.ctx,t=this.time,menu=view.mode==='title',room=ROOMS[state.room];
  const px=menu?659:state.x,py=menu?451:state.y;
  const targetX=menu?(this.width<700?630:477):(this.width<900?clamp(px,180,844):512);
  this.cam.x+=(targetX-this.cam.x)*Math.min(1,dt*5);this.cam.y=320;
  this.offsetX=Math.round(this.width/2-this.cam.x);this.offsetY=Math.round(this.height/2-320);
  c.setTransform(1,0,0,1,0,0);c.fillStyle='#081114';c.fillRect(0,0,this.width,this.height);c.save();
  const shake=(!view.settings.reducedMotion&&view.threat&&view.threat.danger>.6)?Math.sin(t*29)*1.4:0;
  c.translate(this.offsetX+shake,this.offsetY);c.drawImage(this.cache[state.room],0,0);
  if(state.room==='hall'&&state.flags.truth)this.drawDoor(c,room.doors.find(d=>d.hidden),true);
  // Tiny moving rain behind, not over, the room's windows.
  for(const p of room.props.filter(p=>p.sprite==='window')){
   c.save();c.globalAlpha=.7;this.sprite(c,p.sprite,p.x,p.y,p.scale);c.restore();
   c.save();c.beginPath();c.rect(p.x+8*p.scale,p.y+14*p.scale,44*p.scale,38*p.scale);c.clip();
   c.fillStyle='#1b515a66';c.fillRect(p.x+6*p.scale,p.y+13*p.scale,46*p.scale,40*p.scale);c.strokeStyle='#9bcecd55';c.lineWidth=1;
   for(let i=0;i<16;i++){const rx=p.x+rand(i+45)*100,ry=p.y+((rand(i+88)*90+t*57)%85);c.beginPath();c.moveTo(rx,ry);c.lineTo(rx-2,ry+8);c.stroke();}c.restore();
  }
  let entities=room.props.filter(p=>p.sprite!=='window').map(p=>({type:'prop',data:p,y:p.y+SPRITES[p.sprite][3]*32*p.scale*.95}));
  entities.push({type:'player',y:py,data:null});
  // The entity is the supplied icon's distorted shadow, deliberately not a new invented monster.
  if(view.threat){const a=view.threat;entities.push({type:'ghost',y:a.y,data:a});}
  else if(state.room==='echo')entities.push({type:'ghost',y:279,data:{x:518,y:279,opacity:.47}});
  else if(menu&&Math.sin(t*.16)>.83)entities.push({type:'ghost',y:256,data:{x:526,y:256,opacity:.18}});
  else if(state.room==='hall'&&state.inventory.includes('key')&&!state.flags.threatDone&&Math.sin(t*.7)>.55)entities.push({type:'ghost',y:258,data:{x:527,y:258,opacity:.23}});
  entities.sort((a,b)=>a.y-b.y);
  for(const e of entities){
   if(e.type==='prop'){
    const p=e.data,s=SPRITES[p.sprite],w=s[2]*32*p.scale,h=s[3]*32*p.scale;
    if(!['frame','star','paper','phone','photo','smallPlant'].includes(p.sprite)){
     c.fillStyle='#02080b45';c.beginPath();c.ellipse(p.x+w*.54,p.y+h*.93,w*.52,h*.11,0,0,Math.PI*2);c.fill();
     c.save();c.translate(p.x+6,p.y+h);c.transform(1,-.08,.35,-.24,0,0);c.globalAlpha=.14;this.sprite(c,p.sprite,0,0,p.scale,true);c.restore();
    }
    c.save();this.sprite(c,p.sprite,p.x,p.y,p.scale);c.restore();
    if(p.sprite==='mirror'){
     c.fillStyle='#1a36463e';c.fillRect(p.x+20*p.scale,p.y+36*p.scale,23*p.scale,74*p.scale);
     if(state.flags.mirror){c.globalAlpha=.2;this.tile(c,'girl',0,0,60,60,p.x+18*p.scale,p.y+53*p.scale,29*p.scale,65*p.scale);c.globalAlpha=1;}
    }
   }else if(e.type==='player')this.drawPlayer(c,px,py,menu?0:state.dir,view.moving&&!menu,t,menu?true:state.light);
   else this.drawGhost(c,e.data,t);
  }
  // Multiply a light map over the textured scene: darkness remains readable.
  const lc=this.lightCanvas.getContext('2d');lc.clearRect(0,0,1024,640);lc.fillStyle=menu?'#71817b':state.light?'#697d78':'#344449';lc.fillRect(0,0,1024,640);
  for(const light of room.lights){
   const flicker=view.settings.reducedMotion?1:.97+Math.sin(t*3.2+light.x)*.02+Math.sin(t*17)*.007;
   const radius=light.r*flicker;
   const g=lc.createRadialGradient(light.x,light.y,0,light.x,light.y,radius);
   const col=light.color==='warm'?'230,211,160':light.color==='red'?'177,91,80':'151,204,210';
   g.addColorStop(0,`rgba(${col},.92)`);g.addColorStop(.35,`rgba(${col},.45)`);g.addColorStop(1,`rgba(${col},0)`);lc.fillStyle=g;lc.fillRect(light.x-radius,light.y-radius,radius*2,radius*2);
  }
  if(menu||state.light){
   // The torch is hand-held: its pool leads the way she faces and swings round
   // smoothly when she turns, instead of a halo pinned to her feet.
   const dir=menu?0:state.dir,[fx,fy]=FACING[dir],k=view.settings.reducedMotion?1:Math.min(1,dt*9);
   this.beam.x+=(fx-this.beam.x)*k;this.beam.y+=(fy-this.beam.y)*k;
   const bx=this.beam.x,by=this.beam.y,ax=Math.abs(bx),ay=Math.abs(by),r=menu?145:185;
   const [hx,hy]=TORCH_HAND[dir],cx=px+hx*.6+bx*(menu?18:46),cy=py-25+hy*.4+by*(menu?8:24);
   lc.save();lc.translate(cx,cy);lc.scale(1+ax*.32-ay*.08,1-ax*.16+ay*.14);
   const g=lc.createRadialGradient(0,0,2,0,0,r);g.addColorStop(0,'#f6ebc1');g.addColorStop(.15,'#e3dbb3dc');g.addColorStop(.65,'#b9b69844');g.addColorStop(1,'#b9b69800');lc.fillStyle=g;lc.fillRect(-r-20,-r-20,r*2+40,r*2+40);lc.restore();
   // Spill around the holder, so she never stands in the dark behind her own beam.
   const s=lc.createRadialGradient(px,py-24,2,px,py-24,menu?70:92);s.addColorStop(0,'#e3dbb3b4');s.addColorStop(.5,'#c9c39d55');s.addColorStop(1,'#b9b69800');lc.fillStyle=s;lc.fillRect(px-100,py-124,200,200);
  }
  c.save();c.globalCompositeOperation='multiply';c.drawImage(this.lightCanvas,0,0);c.restore();
  // Warm bulbs and bloom sit above the light map, with restrained intensity.
  for(const light of room.lights){
   if(light.color==='warm'){
    c.save();c.globalCompositeOperation='screen';const g=c.createRadialGradient(light.x,light.y,0,light.x,light.y,87);g.addColorStop(0,'#fbc9893e');g.addColorStop(.3,'#d2985419');g.addColorStop(1,'#d2985400');c.fillStyle=g;c.fillRect(light.x-87,light.y-87,174,174);c.fillStyle='#d9bc77a0';c.fillRect(light.x-2,light.y-2,4,3);c.restore();
   }
  }
  if(!menu&&view.mode==='play'&&!view.dialogue){
   for(const h of getHotspots(state.room,state)){
    const dist=Math.hypot(h.x-px,h.y-py);
    const done=(h.id==='letter'&&state.notes.includes('letter'))||(h.id==='drawer'&&state.flags.drawer)||(h.id==='diary'&&state.notes.includes('diary'))||(h.id==='bed'&&state.flags.bed);
    if(done)continue;
    const a=dist<160?.7:.24;
    c.save();c.globalAlpha=a;c.fillStyle=h.id===view.nearest?.id?'#e5d59d':'#bfc0a0';
    c.translate(h.x,h.y-35);c.rotate(Math.PI/4);const q=(h.id===view.nearest?.id)?3:2;c.fillRect(-q,-q,q*2,q*2);c.restore();
   }
  }
  // A stationary silhouette never becomes a full-screen jump-scare.
  if(state.room==='hall'&&state.flags.truth){c.fillStyle='#b3aa7844';c.fillRect(498,239,49,3);}
  // Atmospheric particles: algorithmic compositing is used only for effects.
  if(!view.settings.reducedMotion){
   c.save();c.globalCompositeOperation='screen';
   for(let i=0;i<50;i++){
    const x=120+(rand(i+8)*800+t*(i%2?2:-1))%800,y=170+(rand(i+123)*375+Math.sin(t*.15+i)*11);
    c.fillStyle=`rgba(170,195,181,${.03+rand(i+344)*.11})`;c.fillRect(Math.round(x),Math.round(y),i%6===0?2:1,1);
   }
   for(let i=0;i<4;i++){
    const fx=200+Math.sin(t*.045+i*2)*190+i*155,fy=423+i*25;const g=c.createRadialGradient(fx,fy,1,fx,fy,210);g.addColorStop(0,'#8caea607');g.addColorStop(1,'#8caea600');c.fillStyle=g;c.fillRect(fx-210,fy-210,420,420);
   }c.restore();
  }
  c.restore();
  if(view.threat){c.fillStyle=`rgba(107,30,29,${view.threat.danger*.12})`;c.fillRect(0,0,this.width,this.height);}
  const brightness=view.settings.brightness??1;
  if(brightness>1){c.save();c.globalCompositeOperation='screen';c.fillStyle=`rgba(95,122,114,${(brightness-1)*.32})`;c.fillRect(0,0,this.width,this.height);c.restore();}
  else if(brightness<1){c.fillStyle=`rgba(0,6,10,${(1-brightness)*.5})`;c.fillRect(0,0,this.width,this.height);}
 }
 drawPlayer(c,x,y,dir,moving,t,light){
  c.fillStyle='#03090bad';c.beginPath();c.ellipse(x,y-2,18,6,0,0,Math.PI*2);c.fill();
  const frame=moving?Math.floor(t*8)%4:0,bob=moving?0:Math.sin(t*1.65)*.7;
  if(light&&dir===3){
   // Facing away: the torch is in front of her body, so only its spill rims her hair and shoulders.
   c.save();c.globalCompositeOperation='screen';const g=c.createRadialGradient(x,y-30,0,x,y-30,26);g.addColorStop(0,'#ffdc9752');g.addColorStop(1,'#edb86b00');c.fillStyle=g;c.fillRect(x-26,y-56,52,52);c.restore();
  }
  c.save();this.tile(c,'girl-walk',frame*60,dir*60,60,60,x-25,y-48+bob,50,50);c.restore();
  if(light&&dir!==3){
   // The torch glows in the hand on the side she faces (left/right/front), never behind her back.
   const [hx,hy]=TORCH_HAND[dir],gx=x+hx,gy=y+hy+bob;
   c.save();c.globalCompositeOperation='screen';const g=c.createRadialGradient(gx,gy,0,gx,gy,17);g.addColorStop(0,'#ffdc9788');g.addColorStop(1,'#edb86b00');c.fillStyle=g;c.fillRect(gx-17,gy-17,34,34);c.fillStyle='#f5dfad';c.fillRect(Math.round(gx)-1,Math.round(gy)-1,3,3);c.restore();
  }
 }
 drawGhost(c,a,t){
  c.save();c.globalAlpha=a.opacity??(.35+(a.danger??0)*.4);
  this.tile(c,'girl-shadow',0,0,60,60,a.x-21,a.y-94,42,96);c.restore();
  if((a.danger??0)>.65){c.fillStyle='#c6c6ae55';c.fillRect(a.x-6,a.y-70,2,1);c.fillRect(a.x+5,a.y-70,2,1);}
 }
}
