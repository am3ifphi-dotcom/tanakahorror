export const ROOM_NAMES = {foyer:'玄関',hall:'渡り廊下',study:'父の書斎',nursery:'子供部屋',echo:'記録のない部屋'};
// Coordinates are source pixels in the external LimeZu 32px atlas, never redrawn furniture.
export const SPRITES = {
  sofa:[7,45,3,3],armchair:[4,44,2,4],wardrobe:[7,48,2,3],wardrobeBroken:[0,61,2,3],
  shelf:[10,68,2,3],shelfGreen:[12,68,2,3],lowShelf:[10,71,2,2],
  desk:[2,36,3,2],deskGreen:[9,38,3,2],deskSide:[0,38,2,3],
  // The 3x2 window at [4,24] is a curtain window with a desk baked into its
  // lower band, which hangs over the wainscot; [7,24] is the plain four-pane
  // glass, so the rooms use that one.
  window:[7,24,2,2],plainWindow:[7,24,2,2],mirror:[8,66,2,5],
  door:[7,48,2,3],lamp:[11,54,1,2],blueLamp:[12,54,1,2],
  plant:[10,44,2,3],palm:[13,44,2,3],smallPlant:[0,48,1,2],
  rug:[7,15,4,3],rugBlue:[13,11,3,4],rugGreen:[3,42,3,2],
  bed:[6,1,2,4],bedWhite:[9,4,3,4],chair:[4,31,1,2],
  paper:[10,36,1,1],photo:[1,50,1,1],phone:[11,55,1,1],
  chest:[10,57,2,2],table:[7,13,3,2],fireplace:[4,68,2,3],
  boxes:[6,57,3,3],fallenShelf:[4,61,3,4],frame:[10,26,1,2],
  books:[2,64,2,2],star:[11,74,2,2],map:[10,66,2,2],piano:[0,15,2,1]
};
const p=(sprite,x,y,scale=1,extra={})=>({sprite,x,y,scale,...extra});
const h=(id,label,x,y,extra={})=>({id,label,x,y,r:62,...extra});
export const ROOMS={
 foyer:{name:ROOM_NAMES.foyer,wall:19,floor:'wood',bounds:[104,248,920,558],
  props:[p('window',290,143,1.15),p('window',730,143,1.15),p('wardrobe',806,196,1.1),p('sofa',684,332,1.25),p('plant',841,397,.9),p('chest',212,317,1.1),p('phone',230,306,.9),p('deskSide',341,208,.85),p('paper',348,204,.65),p('frame',415,154,.9),p('lamp',639,274,1),p('smallPlant',196,249,.8)],
  rug:{sprite:'rug',x:424,y:334,scale:1.35},lights:[{x:654,y:287,r:220,color:'warm'},{x:775,y:226,r:180,color:'cold'},{x:333,y:224,r:140,color:'cold'}],
  doors:[{id:'to-hall',label:'渡り廊下へ',x:526,y:241,side:'top',to:'hall',spawn:[512,490]},{id:'exit',label:'玄関の扉',x:111,y:456,side:'left'}],
  hotspots:[h('phone','受話器',247,378),h('letter','母の置き手紙',365,290),h('photo','家族写真',432,254)],
 },
 hall:{name:ROOM_NAMES.hall,wall:17,floor:'wood',bounds:[136,248,888,558],
  props:[p('window',206,151,1),p('window',735,151,1),p('chest',382,215,.85),p('blueLamp',670,206,.9),p('plant',778,470,.85),p('frame',637,156,.8),p('wardrobe',181,457,.75)],
  rug:{sprite:'rug',x:440,y:317,scale:1.2},lights:[{x:250,y:217,r:160,color:'cold'},{x:781,y:220,r:190,color:'cold'},{x:684,y:217,r:145,color:'warm'}],
  doors:[{id:'to-foyer',label:'玄関へ',x:512,y:552,side:'bottom',to:'foyer',spawn:[526,292]},{id:'to-study',label:'父の書斎へ',x:147,y:399,side:'left',to:'study',spawn:[851,413]},{id:'to-nursery',label:'子供部屋へ',x:877,y:399,side:'right',to:'nursery',spawn:[171,413]},{id:'to-echo',label:'壁の継ぎ目',x:522,y:241,side:'top',to:'echo',spawn:[512,497],hidden:true}],
  hotspots:[h('clock','止まった時計',413,294),h('scratches','壁の文字',654,258)],
 },
 study:{name:ROOM_NAMES.study,wall:13,floor:'wood',bounds:[104,248,920,558],
  props:[p('shelf',177,174,1.15),p('shelf',258,174,1.15),p('shelfGreen',339,174,1.15),p('shelf',657,174,1.15),p('window',497,151,1),p('desk',407,338,1.3),p('paper',450,329,.65),p('armchair',408,441,.55),p('chest',209,376,1.15),p('deskSide',742,287,1.1),p('piano',748,294,.8),p('lamp',834,209,1),p('books',626,449,.7)],
  rug:{sprite:'rugGreen',x:368,y:333,scale:1.7},lights:[{x:850,y:220,r:210,color:'warm'},{x:548,y:211,r:165,color:'cold'}],
  doors:[{id:'to-hall',label:'渡り廊下へ',x:909,y:421,side:'right',to:'hall',spawn:[198,400]}],
  hotspots:[h('drawer','四桁の引き出し',248,461),h('ledger','父の記録',468,427),h('recorder','テープレコーダー',778,409)],
 },
 nursery:{name:ROOM_NAMES.nursery,wall:17,floor:'wood',bounds:[136,248,888,558],
  props:[p('window',466,143,1.15),p('bed',282,240,1.15),p('bedWhite',655,242,1),p('lowShelf',188,217,1),p('star',370,156,.6),p('star',614,172,.45),p('chest',243,395,1),p('paper',259,387,.65),p('armchair',486,360,.8),p('mirror',798,204,.7),p('blueLamp',735,414,.8)],
  rug:{sprite:'rugGreen',x:415,y:392,scale:1.5},lights:[{x:515,y:220,r:260,color:'cold'},{x:748,y:425,r:120,color:'warm'}],
  doors:[{id:'to-hall',label:'渡り廊下へ',x:147,y:421,side:'left',to:'hall',spawn:[824,400]}],
  hotspots:[h('bed','妹の寝台',704,389),h('diary','破られた日記',275,469),h('mirror','姿見',823,349)],
 },
 echo:{name:ROOM_NAMES.echo,wall:13,floor:'tile',bounds:[168,248,856,558],
  props:[p('wardrobeBroken',197,220,1),p('fallenShelf',724,243,.75),p('mirror',480,140,1.2),p('chair',279,377,1.2),p('chair',372,377,1.2),p('chair',593,377,1.2),p('chair',688,377,1.2),p('phone',280,360,.8),p('phone',372,360,.8),p('phone',593,360,.8),p('phone',688,360,.8),p('paper',505,407,.8)],
  rug:null,lights:[{x:519,y:288,r:270,color:'red'}],
  doors:[{id:'to-hall',label:'渡り廊下へ',x:512,y:552,side:'bottom',to:'hall',spawn:[522,299]}],
  hotspots:[h('threshold','鏡の向こうの声',517,329,{r:75}),h('last-page','最後の記録',517,465)],
 }
};
export function getHotspots(room,state){
 const r=ROOMS[room];
 return [...r.hotspots,...r.doors.filter(d=>!d.hidden||state.flags.truth).map(d=>({...d,r:66}))];
}
export function collisions(room){
 return ROOMS[room].props.filter(p=>!['window','plainWindow','frame','paper','phone','photo','star','books','smallPlant'].includes(p.sprite)).map(p=>{
  const rect=SPRITES[p.sprite],w=rect[2]*32*p.scale,h=rect[3]*32*p.scale;
  return {x:p.x+6,y:p.y+h*.63,w:w-12,h:h*.29};
 });
}
export function canWalk(room,x,y){
 const [l,t,r,b]=ROOMS[room].bounds;
 if(x<l+10||x>r-10||y<t+8||y>b-8)return false;
 return !collisions(room).some(o=>x>o.x-8&&x<o.x+o.w+8&&y>o.y-5&&y<o.y+o.h+5);
}
