import {ROOMS} from './world.js';
export const SAVE_KEY='yohaku-house-save-v1';
export const SETTINGS_KEY='yohaku-house-settings-v1';
export const ENDINGS_KEY='yohaku-house-endings-v1';
export const NOTES={
 letter:{title:'母の置き手紙',where:'玄関',body:'おかえり。\n部屋は、あの夜のままにしてあります。\n\n廊下で名前を呼ばれても、返事をしてはいけません。\n足音があなたの歩調を追い越したら、灯りを消して、動かないこと。\n止むまで待てば、通り過ぎます。\n\n「妹を連れて帰って」と書いた行だけ、何度も消されている。'},
 photo:{title:'ひとり多い家族写真',where:'玄関',body:'父、母、私。そして妹の澪。\n裏には「四人家族」と書かれている。\n\nでも、窓ガラスには五人ぶんの顔が映っている。\n五人目は、私と同じ服を着ていた。'},
 clock:{title:'午前二時十七分',where:'渡り廊下',body:'時計は、午前二時十七分で止まっている。\n\n父の字で、小さなメモが貼られていた。\n「書斎の引き出し。忘れないよう、あの時刻を四桁で。\n時、分の順。足りない桁は、零で埋める」'},
 ledger:{title:'父の記録',where:'父の書斎',body:'十月十六日\n録音には、まだ話していない言葉が入っている。\nこの家は声を真似るのではない。返事をさせて、その先の人生を持っていく。\n\n澪は最後まで返事をしなかった。\nだから、まだこちら側の名前を持っている。\n\n二本のテープを続けて聴けば、壁の向こうへ行ける。'},
 diary:{title:'澪の日記',where:'子供部屋',body:'おねえちゃんへ。\n\nあれは、よんでもこない。\nへんじをすると、くる。\n\nわたしのこえがしても、なまえをよばないで。\nむかえにきたら、いつものように、てをだして。\n\nわたしのてがつめたくても、はなさないで。'},
 tapeA:{title:'録音 A ── まだ言っていない言葉',where:'父の書斎',body:'録音に、母の息づかい。\n「この家の中で、あの子を呼ばないで」\n\n続いて、私の声。\n「ただいま」\n\n七年前の録音なのに、今と同じ雨が降っている。'},
 tapeB:{title:'録音 B ── 残ったのは誰か',where:'父の書斎',body:'妹の声が、録音の向こうで言った。\n「おねえちゃんが帰ってくるまで、わたし、返事しないよ」\n\nあの夜、私の名前で返事をしたのは、家だった。\n妹は、私を待っていたのではない。\n私のふりをしたものを、家の外へ出さないために残った。'},
 lastPage:{title:'最後の記録',where:'記録のない部屋',body:'家は、返事しか持っていない。\n呼びかけることはできても、先に手を差し出すことはできない。\n\n沈黙は、拒絶ではない。\nあの子と交わした、最初の約束だった。'}
};
export const ITEMS={key:{name:'真鍮の小さな鍵',symbol:'⚿',text:'子供部屋の鍵。手の中で、まだ温かい。'},tapeA:{name:'カセットテープ A',symbol:'▣',text:'父の引き出しにあった録音。書斎で再生できる。'},tapeB:{name:'カセットテープ B',symbol:'▣',text:'妹の枕の下にあった録音。書斎で再生できる。'}};
export function newState(){return {version:1,room:'foyer',x:531,y:469,dir:3,light:true,flags:{},inventory:[],notes:[],replies:0,visits:{foyer:1},time:0,ending:null};}
export function addNote(s,id){if(NOTES[id]&&!s.notes.includes(id))s.notes.push(id);}
export function addItem(s,id){if(ITEMS[id]&&!s.inventory.includes(id))s.inventory.push(id);}
export function objective(s){
 if(s.flags.truth)return s.notes.includes('diary')?'廊下に現れた扉へ。名前は呼ばない。':'廊下に、なかったはずの扉がある。';
 if(s.inventory.includes('tapeB'))return '二本のテープを、書斎のレコーダーで聴く。';
 if(s.inventory.includes('key'))return '鍵を使って、子供部屋を調べる。';
 if(s.notes.includes('clock'))return '書斎の引き出しに、止まった時刻を入力する。';
 if(s.notes.includes('ledger'))return '廊下の時計を調べ、引き出しの暗証番号を探す。';
 if(s.notes.includes('letter'))return '廊下から、父の書斎を探す。';
 return '母の置き手紙を探す。光る場所で E。';
}
export function chapter(s){return s.flags.truth?'第三章　返事':s.inventory.includes('key')?'第二章　留守番':'第一章　帰宅';}
export function unlockDrawer(s,code){
 if(code!=='0217')return false;
 addItem(s,'key');addItem(s,'tapeA');s.flags.drawer=true;return true;
}
export function canEnter(s,to){
 if(to==='nursery'&&!s.inventory.includes('key'))return false;
 if(to==='echo'&&!s.flags.truth)return false;
 return to in ROOMS;
}
export function endingFor(choice,s){
 if(choice==='leave')return 'alone';
 if(choice==='hand'&&s.flags.truth&&s.notes.includes('diary'))return 'silence';
 return 'answer';
}
export function restoreState(raw){
 try{
  const data=typeof raw==='string'?JSON.parse(raw):raw;
  if(!data||data.version!==1||!ROOMS[data.room]||!Array.isArray(data.inventory)||!Array.isArray(data.notes))return null;
  const s=newState();s.room=data.room;
  const [l,t,r,b]=ROOMS[s.room].bounds;
  s.x=Number.isFinite(data.x)?Math.max(l+14,Math.min(r-14,data.x)):512;
  s.y=Number.isFinite(data.y)?Math.max(t+14,Math.min(b-14,data.y)):500;
  s.dir=[0,1,2,3].includes(data.dir)?data.dir:0;s.light=typeof data.light==='boolean'?data.light:true;
  s.inventory=[...new Set(data.inventory.filter(k=>ITEMS[k]))];s.notes=[...new Set(data.notes.filter(k=>NOTES[k]))];
  const flags=['phone','drawer','mirror','bed','truth','threatDone','scratches','finalNote','intro'];
  for(const k of flags)if(data.flags?.[k]===true)s.flags[k]=true;
  // Repair milestone dependencies rather than loading an unwinnable partial save.
  if(s.inventory.includes('tapeB')){addItem(s,'key');addItem(s,'tapeA');s.flags.bed=true;}
  if(s.flags.truth){addItem(s,'key');addItem(s,'tapeA');addItem(s,'tapeB');addNote(s,'tapeA');addNote(s,'tapeB');}
  if(s.room==='nursery')addItem(s,'key');
  if(s.room==='echo'&&!s.flags.truth){s.room='hall';s.x=522;s.y=300;}
  s.replies=Math.max(0,Math.min(20,Number(data.replies)||0));s.time=Math.max(0,Number(data.time)||0);
  s.visits={};for(const k of Object.keys(ROOMS))s.visits[k]=Math.max(0,Math.min(100,Number(data.visits?.[k])||0));
  s.ending=['alone','answer','silence'].includes(data.ending)?data.ending:null;
  return s;
 }catch{return null;}
}
export function getStorage(key,fallback=null){try{const v=localStorage.getItem(key);return v===null?fallback:JSON.parse(v);}catch{return fallback;}}
export function setStorage(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
export const ENDINGS={
 silence:{index:'01',title:'沈黙の帰還',body:'私は、何も言わずに手を差し出した。\n小さな指が、私の指を握り返した。\n\n玄関を出るまで、私たちは一度も名前を呼ばなかった。\n雨の中には、ふたりぶんの足音があった。\n\n後ろで、私の声がした。\n「おかえり」\n\nもう、返事はしなかった。',foot:'あなたは、声ではなく、約束を連れて帰った。'},
 answer:{index:'02',title:'ただいま',body:'「澪。迎えにきたよ」\n\n鏡の向こうの私が、先に笑った。\n冷たい手が、私の喉に触れた。\n\n翌朝、田中邸からひとりの少女が出てきた。\n近所の人に声をかけられて、少女は返事をした。\n\nその声は、誰の記憶とも少しずつ違っていた。',foot:'この家は、またひとつ、返事を覚えた。'},
 alone:{index:'03',title:'ひとりぶんの足音',body:'鍵を置き、私は家を出た。\n妹の声には、もう返事をしない。\n\nそれで、終わったはずだった。\n\n新しい部屋の玄関で、靴を脱ぐ。\n暗い廊下から、声がした。\n\n「今度は、わたしが帰る番だよね」',foot:'家からは出た。それだけだった。'}
};
