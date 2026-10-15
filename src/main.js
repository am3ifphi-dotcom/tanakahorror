import './style.css';
import {Renderer} from './renderer.js';
import {Sound} from './audio.js';
import {ROOMS,ROOM_NAMES,getHotspots,canWalk} from './world.js';
import {newState,addNote,addItem,objective,chapter,unlockDrawer,canEnter,endingFor,restoreState,getStorage,setStorage,SAVE_KEY,SETTINGS_KEY,ENDINGS_KEY,NOTES,ITEMS,ENDINGS} from './state.js';
const $=id=>document.getElementById(id);
const show=id=>$(id).classList.remove('hidden'),hide=id=>$(id).classList.add('hidden');
const sound=new Sound(),renderer=new Renderer($('scene'));
let state=newState(),mode='title',dialogue=null,modalType=null,nearest=null,threat=null,moving=false,transitioning=false;
let keys=new Set(),path=[],pathAction=null,stepTimer=0,stepIndex=0,lastTime=0,ambientTimer=0,elapsed=0,dialogTimer=0;
let toastTimer,whisperTimer,announceTimer,saveTimer,lastFocus=null;
const rawSettings=getStorage(SETTINGS_KEY,{});
const settings={volume:Number.isFinite(rawSettings?.volume)?Math.max(0,Math.min(1,rawSettings.volume)):.55,brightness:Number.isFinite(rawSettings?.brightness)?Math.max(.6,Math.min(1.8,rawSettings.brightness)):1.15,reducedMotion:rawSettings?.reducedMotion??matchMedia('(prefers-reduced-motion: reduce)').matches,muted:!!rawSettings?.muted};
function applySettings(){sound.setVolume(settings.volume,settings.muted);document.body.classList.toggle('reduced-motion',settings.reducedMotion);setStorage(SETTINGS_KEY,settings);}
applySettings();
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3400);}
function whisper(text,duration=5500){$('whisper').textContent=text;$('whisper').classList.add('visible');clearTimeout(whisperTimer);whisperTimer=setTimeout(()=>$('whisper').classList.remove('visible'),duration);}
function save(){
 const ok=setStorage(SAVE_KEY,state);
 $('save-indicator').innerHTML=ok?'記録しました <i>◇</i>':'記録できません <i>!</i>';
 $('save-indicator').style.opacity='1';clearTimeout(saveTimer);saveTimer=setTimeout(()=>{$('save-indicator').style.opacity='.5';},2500);
 updateContinue();if(!ok)toast('ブラウザの保存領域が使えません。このプレイは保存されません。');
}
function updateContinue(){const s=restoreState(getStorage(SAVE_KEY));$('continue-game').disabled=!s;$('continue-game').querySelector('.save-label').textContent=s?'自動記録':'記録なし';}
function clearInputs(){keys.clear();path=[];pathAction=null;moving=false;}
function updateHud(){
 $('chapter').textContent=chapter(state);$('room-name').textContent=ROOM_NAMES[state.room];$('objective').textContent=objective(state);
 $('light-label').textContent=state.light?'灯り ON':'灯り OFF';$('light-dot').style.background=state.light?'#d6c382':'#506368';$('light-dot').style.boxShadow=state.light?'0 0 8px #efc36c':'none';
}
function announce(){
 $('room-announcement').textContent=ROOM_NAMES[state.room];$('room-announcement').classList.add('visible');clearTimeout(announceTimer);announceTimer=setTimeout(()=>$('room-announcement').classList.remove('visible'),2400);
}
function say(pages,onFinish=null){
 clearInputs();hide('interaction');
 dialogue={pages:pages.map(p=>typeof p==='string'?{text:p,speaker:'私'}:p),index:0,onFinish,typed:0};
 show('dialogue');drawPage();
}
function drawPage(){
 const p=dialogue.pages[dialogue.index];dialogue.typed=settings.reducedMotion?p.text.length:0;dialogTimer=0;
 $('dialogue-speaker').textContent=p.speaker||'私';$('dialogue-text').textContent=settings.reducedMotion?p.text:'';
 $('dialogue-choices').replaceChildren();$('dialogue-next').classList.toggle('hidden',!!p.choices);
 document.querySelector('.dialogue-portrait').style.display=(p.speaker&&p.speaker!=='私')?'none':'flex';
 if(p.choices){
  dialogue.typed=p.text.length;$('dialogue-text').textContent=p.text;
  for(const ch of p.choices){const b=document.createElement('button');b.textContent=ch.label;b.onclick=()=>{dialogue=null;hide('dialogue');clearInputs();ch.run();};$('dialogue-choices').appendChild(b);}
  $('dialogue-choices').querySelector('button')?.focus({preventScroll:true});
 }else $('dialogue-next').focus({preventScroll:true});
}
function advanceDialogue(){
 if(!dialogue||modalType)return;
 const p=dialogue.pages[dialogue.index];if(p.choices)return;
 if(dialogue.typed<p.text.length){dialogue.typed=p.text.length;$('dialogue-text').textContent=p.text;return;}
 sound.play('cloth_1',{gain:.04,rate:.9});
 dialogue.index++;
 if(dialogue.index<dialogue.pages.length)drawPage();
 else {const cb=dialogue.onFinish;dialogue=null;hide('dialogue');clearInputs();cb?.();updateHud();$('scene').focus({preventScroll:true});}
}
$('dialogue-next').onclick=advanceDialogue;
$('dialogue-text').onclick=advanceDialogue;
function record(id,pages){
 const first=!state.notes.includes(id);addNote(state,id);save();updateHud();sound.play('book_open',{gain:.2,rate:.8});
 say(pages||[{speaker:NOTES[id].title,text:NOTES[id].body}],()=>{if(first)toast('手帳に記録しました ── J で読み返す');});
}
async function initialiseSound(){
 try{const failures=await sound.init();applySettings();sound.ambience(state.room);if(failures)toast('一部の音源を読み込めませんでした。字幕で進行できます。');}
 catch{toast('このブラウザでは音声を開始できません。字幕で進行できます。');}
}
function startGame(resume=false){
 state=resume?restoreState(getStorage(SAVE_KEY))||newState():newState();mode='play';threat=null;dialogue=null;clearInputs();
 hide('title');hide('ending');hide('dialogue');hide('threat');show('hud');closeModal();updateHud();announce();
 if(!canWalk(state.room,state.x,state.y)){state.x=512;state.y=500;}
 renderer.cam.x=state.x;initialiseSound();
 if(!resume){
  say([{speaker:'七年後 ── 十月十六日',text:'母が亡くなったあと、古い家の鍵と、一通の手紙が届いた。'},'「澪を、迎えに行ってあげて」\n妹は七年前、この家からいなくなった。','玄関の奥から、私が帰ってきたことを知っているような、気配がした。',{speaker:'探索',text:'WASD / 矢印で移動。光る場所の近くで E を押すと調べられます。\n画面の行きたい場所をクリックしても移動できます。\n手帳 J には、目的と集めた記録が残ります。'}],()=>{state.flags.intro=true;save();});
 }else if(state.ending){state.ending=null;save();toast('結末直前の記録から再開しました');}
 if(resume&&state.room==='hall'&&state.inventory.includes('tapeB')&&!state.flags.threatDone)beginThreat();
}
$('new-game').onclick=()=>{
 if(restoreState(getStorage(SAVE_KEY))){openModal('はじめから','confirm',`<p>現在の自動記録を上書きして、最初から始めます。<br>見つけた結末の一覧は残ります。</p><div class="modal-actions"><button class="text-button" id="confirm-new">最初から始める</button><button class="text-button" id="cancel-new">戻る</button></div>`);$('confirm-new').onclick=()=>startGame(false);$('cancel-new').onclick=closeModal;}
 else startGame(false);
};
$('continue-game').onclick=()=>startGame(true);
$('title-settings').onclick=()=>openSettings();$('title-credits').onclick=()=>openCredits();
function openModal(title,type,html){
 clearInputs();lastFocus=document.activeElement;modalType=type;
 $('modal-title').textContent=title;$('modal-content').innerHTML=html;show('modal');$('modal-close').focus({preventScroll:true});
 if(type!=='code')sound.suspend();
}
function closeModal(){
 const prev=modalType;hide('modal');modalType=null;clearInputs();
 if(mode==='play'){sound.resume();if(prev!=='code')sound.setVolume(settings.volume,settings.muted);}
 if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});
}
$('modal-close').onclick=closeModal;
$('modal').onclick=e=>{if(e.target===$('modal'))closeModal();};
function openSettings(paused=false){
 openModal(paused?'ひと休み':'設定・操作','settings',`
  <p class="fine-print">不穏な音響、暗所、追跡の演出を含みます。大音量にはせず、無理のない範囲でお楽しみください。</p>
  <div class="setting-row"><label for="volume">音量<small>環境音・足音・効果音</small></label><input id="volume" type="range" min="0" max="100" value="${Math.round(settings.volume*100)}"><output id="volume-value">${Math.round(settings.volume*100)}%</output></div>
  <div class="setting-row"><label for="brightness">明るさ<small>暗い画面では調整してください</small></label><input id="brightness" type="range" min="60" max="180" value="${Math.round(settings.brightness*100)}"><output id="brightness-value">${Math.round(settings.brightness*100)}%</output></div>
  <div class="setting-row"><label for="mute">音を消す<small>危険と手がかりは字幕でも表示</small></label><input id="mute" type="checkbox" ${settings.muted?'checked':''}></div>
  <div class="setting-row"><label for="motion">画面の揺れ・微光の変動を抑える</label><input id="motion" type="checkbox" ${settings.reducedMotion?'checked':''}></div>
  <h3>操作</h3><div class="controls-grid"><span><kbd>W A S D</kbd> / 矢印　移動</span><span><kbd>E</kbd> / Enter　調べる・次へ</span><span><kbd>F</kbd> 灯りを切り替える</span><span><kbd>Shift</kbd> 走る</span><span><kbd>J</kbd> 手帳・見取り図</span><span><kbd>Esc</kbd> 一時停止・閉じる</span></div>
  <p class="fine-print">クリック／タップで移動、対象をクリックして調べることもできます。<br>自動保存は部屋の移動・発見時に行います。同じブラウザで再開できます。</p>
  <div class="modal-actions"><button class="text-button" id="fullscreen">全画面表示を切替</button>${paused?'<button class="text-button" id="resume-play">探索に戻る</button><button class="text-button danger" id="back-title">タイトルへ</button>':''}</div>`);
 $('volume').oninput=e=>{settings.volume=+e.target.value/100;$('volume-value').textContent=e.target.value+'%';applySettings();};
 $('brightness').oninput=e=>{settings.brightness=+e.target.value/100;$('brightness-value').textContent=e.target.value+'%';applySettings();};
 $('mute').onchange=e=>{settings.muted=e.target.checked;applySettings();};$('motion').onchange=e=>{settings.reducedMotion=e.target.checked;applySettings();};
 $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('game').requestFullscreen();}catch{toast('埋め込み表示では全画面にできない場合があります。別タブでお試しください。');}};
 if(paused){$('resume-play').onclick=closeModal;$('back-title').onclick=()=>{if(!threat)save();toTitle();};}
}
function openCredits(){
 const found=getStorage(ENDINGS_KEY,[]);
 openModal('制作・素材','credits',`
 <p>返事のない家 <span style="color:#738773">／ THE HOUSE THAT ANSWERS</span><br>返事をするたび、家はあなたに近づく。<br>アイコンを出発点にした、短編探索サイコロジカルホラー。</p>
 <div class="credits-block"><h3>LimeZu</h3><p>Modern Interiors Free v2.2 — 室内、床、壁、家具、扉、窓、装飾。<br><strong>無料版は非商用限定。</strong> 使用・編集可、商用利用・編集素材の再販売不可。<br><a href="https://limezu.itch.io/moderninteriors" target="_blank" rel="noopener noreferrer">作者・配布元</a> · <a href="/licenses/limezu-free.txt" target="_blank">同梱ライセンス原文</a></p></div>
 <div class="credits-block"><h3>Kenney</h3><p>RPG Audio — 足音、木の軋み、扉、紙、金属、衣擦れ。CC0 1.0。<br>軋み音を速度・フィルタ調整して環境音に使用しています。<br><a href="https://kenney.nl/assets/rpg-audio" target="_blank" rel="noopener noreferrer">作者・配布元</a> · <a href="/licenses/kenney-audio.txt" target="_blank">CC0 原文</a></p></div>
 <div class="credits-block"><h3>Character & Direction</h3><p>主人公：提供画像 source/girl_idle.png。原作者・利用許諾範囲は未確認。<br>本作向けに歩行・背面を補完。怪異は同画像の影・変形表現です。<br>シナリオ、部屋の配置、光・霧・埃、UI、ゲームコード：本作オリジナル。<br>録音の言葉は字幕演出で、音声朗読・楽曲BGMはありません。</p></div>
 <div class="credits-block"><h3>Typography</h3><p>Noto Serif JP / Google · Cormorant Garamond / Christian Thalmann<br>SIL Open Font License 1.1。フォントはローカル同梱。</p></div>
 <p class="fine-print">本作品は非商用デモです。素材の権利は各作者に帰属します。<br>素材の転用や商用展開には、別途適切な許諾が必要です。<br><a class="credits-link" href="/CREDITS.md" target="_blank">取得元・条件・加工内容の一覧</a></p>
 <h3>見つけた結末 ${Array.isArray(found)?found.length:0} / 3</h3><p class="fine-print">${Object.entries(ENDINGS).map(([k,e])=>`${e.index}　${Array.isArray(found)&&found.includes(k)?e.title:'未発見'}`).join('<br>')}</p>`);
}
function openJournal(tab='notes'){
 let content='';
 if(tab==='notes')content=state.notes.length?state.notes.map((id,i)=>`<article class="note-card"><span>RECORD ${String(i+1).padStart(2,'0')} / ${NOTES[id].where}</span><h3>${NOTES[id].title}</h3><p>${NOTES[id].body}</p></article>`).join(''):'<p>まだ何も記されていない。<br>調べた手紙や写真は、ここで読み返せる。</p>';
 if(tab==='items')content=state.inventory.length?state.inventory.map(id=>`<article class="item-card"><span class="item-symbol">${ITEMS[id].symbol}</span><div><h4>${ITEMS[id].name}</h4><p>${ITEMS[id].text}</p></div></article>`).join(''):'<p>持ち物は、まだない。</p>';
 if(tab==='map')content=`<p class="fine-print">${objective(state)}</p><div class="map-layout">${Object.keys(ROOMS).map(id=>`<div class="map-room ${id} ${id===state.room?'current':''} ${id==='echo'&&!state.flags.truth?'unknown':''}">${id==='echo'&&!state.flags.truth?'壁':ROOM_NAMES[id]}<small>${id===state.room?'現在地':id==='nursery'&&!state.inventory.includes('key')?'施錠':state.visits[id]?'訪問済み':'未探索'}</small></div>`).join('')}</div><p class="fine-print">見取り図からの移動はできません。扉の近くで E を押してください。<br>書斎と子供部屋は、廊下の左右にあります。</p>`;
 openModal('手帳','journal',`<div class="tabs"><button data-tab="notes" class="${tab==='notes'?'active':''}">記録 ${state.notes.length}</button><button data-tab="items" class="${tab==='items'?'active':''}">持ち物 ${state.inventory.length}</button><button data-tab="map" class="${tab==='map'?'active':''}">見取り図</button></div><div>${content}</div>`);
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>openJournal(b.dataset.tab));
}
$('journal-button').onclick=()=>openJournal();$('pause-button').onclick=()=>openSettings(true);
function toTitle(){
 closeModal();mode='title';dialogue=null;threat=null;state=newState();hide('dialogue');hide('hud');hide('ending');hide('threat');show('title');$('whisper').classList.remove('visible');clearInputs();sound.stopAmbient();sound.suspend();updateContinue();$('new-game').focus({preventScroll:true});
}
async function changeRoom(to,spawn){
 if(transitioning)return;transitioning=true;clearInputs();$('transition').classList.add('black');sound.play('door_open_1',{gain:.2,rate:.7});
 await new Promise(r=>setTimeout(r,settings.reducedMotion?50:480));
 state.room=to;[state.x,state.y]=spawn;state.dir=to==='hall'?0:3;state.visits[to]=(state.visits[to]||0)+1;
 if(!canWalk(to,state.x,state.y)){const p=findWalkable(state.x,state.y);state.x=p.x;state.y=p.y;}
 sound.ambience(to);updateHud();save();announce();nearest=null;
 $('transition').classList.remove('black');transitioning=false;
 if(to==='hall'&&state.inventory.includes('tapeB')&&!state.flags.threatDone)beginThreat();
 else if(to==='hall'&&state.flags.truth&&state.visits.hall<8)whisper('この扉は、さっきまでなかった。');
 else if(to==='foyer'&&state.visits.foyer===2){whisper('受話器が、置かれている向きだけ変わっている。');sound.knock();}
 else if(to==='nursery'&&state.visits.nursery===1)whisper('ひとつだけ、布団が温かい。');
 else if(to==='echo')whisper('ここには、私の足音がない。');
}
function beginThreat(){
 sound.stopAmbient();
 say([{speaker:'廊下の奥',text:'……こつ。……こつ。\n私が止まっても、足音が止まらない。'},{speaker:'母の手紙の言葉',text:'「灯りを消して、動かないこと。足音が止むまで」\nF で消灯し、その場で約5秒、待つ。\n動いたり灯りをつけると、近づいてくる。'}],()=>{
  threat={x:350,y:330,danger:.06,quiet:0,grace:3.5,elapsed:0,step:0};show('threat');whisper('あなたの歩調を、追い越してくる。',3500);
 });
}
function updateThreat(dt){
 if(!threat)return;
 const a=threat;a.elapsed+=dt;a.step+=dt;
 if(a.grace>0)a.grace-=dt;
 else if(!state.light&&!moving){a.quiet+=dt;a.danger=Math.max(.02,a.danger-dt*.13);}
 else{a.quiet=0;a.danger=Math.min(1,a.danger+dt*(state.light?.075:.045)+(moving?dt*.04:0));}
 const targetX=state.x-135+a.danger*105,targetY=state.y-45+a.danger*30;
 a.x+=(targetX-a.x)*dt*.8;a.y+=(targetY-a.y)*dt*.8;
 if(a.step>1.1){a.step=0;sound.play('footstep_2',{gain:.12+a.danger*.2,rate:.58,pan:-.6,filter:900});}
 $('threat-meter').style.width=`${Math.round(a.danger*100)}%`;
 $('threat-hint').textContent=a.grace>0?'灯りを消して、動かない。':(!state.light&&!moving)?'そのまま、足音が止むまで。':'F で消灯。立ち止まって、息をひそめる。';
 if(a.quiet>=5){
  threat=null;hide('threat');state.flags.threatDone=true;save();sound.ambience(state.room);whisper('足音は、あなたの中を通り過ぎていった。',6000);
 }else if(a.danger>=1){
  threat=null;hide('threat');clearInputs();sound.stopAmbient();
  say([{speaker:'あなたのすぐ後ろ',text:'「そこに、いたんだね」'},{speaker:'記憶が途切れた',text:'灯りと足音を、家は覚えている。\n次は、灯りを消して、その場で待とう。',choices:[{label:'直前の記録からやり直す',run:()=>startGame(true)},{label:'タイトルへ',run:toTitle}]}]);
 }
}
function openCode(){
 openModal('四桁の引き出し','code',`<p>鍵穴の横に、四つの数字盤。<br>「あの時刻を、忘れないように」</p><form id="code-form"><div class="lock-code"><input id="lock-input" aria-label="四桁の暗証番号" inputmode="numeric" autocomplete="off" maxlength="4" pattern="[0-9]{4}" placeholder="0000" required></div><p class="lock-caption">時・分の順に四桁。手がかりは廊下の時計。</p><p class="code-message" id="code-message" aria-live="polite"></p><button class="text-button full-width" type="submit">引き出しを開ける</button></form>`);
 $('lock-input').oninput=e=>{e.target.value=e.target.value.replace(/[^0-9]/g,'');};
 $('lock-input').focus();$('code-form').onsubmit=e=>{
  e.preventDefault();if(unlockDrawer(state,$('lock-input').value)){
   closeModal();sound.play('metal_latch',{gain:.25,rate:.8});save();updateHud();
   say(['乾いた音がして、引き出しが開いた。\n中には、真鍮の小さな鍵と、一本のカセットテープ。',{speaker:'入手',text:'「子供部屋の鍵」と「カセットテープ A」を手に入れた。\nテープは、書斎の右側にあるレコーダーで再生できる。'}],()=>toast('鍵を使って、廊下右側の子供部屋へ'));
  }else{$('code-message').textContent='……開かない。時計は、何時で止まっていた？';sound.play('metal_click',{gain:.1,rate:.8});}
 };
}
function interact(id){
 if(mode!=='play'||dialogue||modalType||transitioning)return;
 if(threat){whisper('今は、動かないほうがいい。',2400);return;}
 const door=ROOMS[state.room].doors.find(d=>d.id===id);
 if(door&&door.to){
  if(!canEnter(state,door.to)){say([door.to==='nursery'?'鍵がかかっている。\n扉の隙間から、石けんの匂いがした。\n昔、妹が使っていたものと同じだ。':'壁紙に、縦の継ぎ目がある。\n向こうから、呼吸のような音がする。']);return;}
  changeRoom(door.to,door.spawn);return;
 }
 switch(id){
  case 'phone':
   if(state.flags.phone){say([state.flags.truth?'受話器から、さっきまでの私の足音が聞こえる。\nここまで歩いてくる音が、何度も、何度も。':'もう、何も聞こえない。\nただ、耳を離すと向こうで誰かが息を吸う。']);break;}
   state.flags.phone=true;save();sound.play('cloth_1',{gain:.18,rate:.5});
   say([{speaker:'受話器の向こう',text:'「おかえり。\nまだ、振り向かないで」'},'妹の声だった。\n七年前より、少しだけ、私に似ている。',{speaker:'受話器の向こう',text:'「……おねえちゃん？」',choices:[{label:'「澪なの？」と返事をする',run:()=>{state.replies++;save();sound.knock();say(['家のどこかで、鍵の開く音がした。\n受話器の向こうの息づかいが、私と同じ速さになった。']);}},{label:'何も言わず、受話器を置く',run:()=>{save();say(['受話器を置いた。\nなのに、「うん」という私の声が聞こえた。']);}}]}]);break;
  case 'letter':record('letter',[{speaker:'母の置き手紙',text:'おかえり。\n部屋は、あの夜のままにしてあります。\n廊下で名前を呼ばれても、返事をしてはいけません。'},{speaker:'母の置き手紙',text:'足音があなたの歩調を追い越したら、灯りを消して、動かないこと。\n止むまで待てば、通り過ぎます。'},'「妹を連れて帰って」と書いた行だけ、何度も消されている。']);break;
  case 'photo':record('photo',['父、母、私。妹の澪。\n裏には「四人家族」と書かれている。','窓ガラスに映っている顔は、五つある。\n五人目は、私と同じ服を着ていた。']);break;
  case 'clock':record('clock',[{speaker:'止まった時計',text:'午前 02 時 17 分。\nあの夜から、針は動いていない。'},{speaker:'時計に貼られたメモ',text:'「書斎の引き出し。忘れないよう、あの時刻を四桁で。\n時、分の順。足りない桁は、零で埋める」'}]);break;
  case 'scratches':
   state.flags.scratches=true;save();say(['壁紙の下に、細い文字がある。\n「返事をしなければ、まだ、あなたのまま」']);break;
  case 'ledger':record('ledger',[{speaker:'父の記録',text:'録音には、まだ話していない言葉が入っている。\nこの家は声を真似るのではない。\n返事をさせて、その先の人生を持っていく。'},{speaker:'父の記録',text:'澪は最後まで返事をしなかった。\nだから、まだこちら側の名前を持っている。\n二本のテープを続けて聴けば、壁の向こうへ行ける。'}]);break;
  case 'drawer':if(state.flags.drawer)say(['引き出しは、もう空だ。\n底に「二時十七分」と刻まれている。']);else openCode();break;
  case 'recorder':
   if(!state.inventory.includes('tapeA')){say(['古いテープレコーダー。電源は入る。\nカセットを探せば、何か聴けるかもしれない。']);break;}
   sound.play('metal_click',{gain:.2});sound.play('creak_3',{gain:.08,rate:.48,filter:1100});
   addNote(state,'tapeA');
   if(!state.inventory.includes('tapeB')){
    save();say([{speaker:'録音 A',text:'「この家の中で、あの子を呼ばないで」\n母の声のあとに、私の声が続く。\n「ただいま」'},'七年前の録音なのに、今と同じ雨が降っている。\nテープの終わりに、「B につづく」と書かれていた。']);
   }else{
    const first=!state.flags.truth;addNote(state,'tapeB');state.flags.truth=true;save();updateHud();
    say([{speaker:'録音 A',text:'「この家の中で、あの子を呼ばないで」\n母の声のあとに、私の声が続く。\n「ただいま」'},{speaker:'録音 B',text:'「おねえちゃんが帰ってくるまで、\nわたし、返事しないよ」'},'あの夜、私の名前で返事をしたのは、家だった。\n妹は、私を待っていたのではない。','私のふりをしたものを、家の外へ出さないために残った。\n七年間、ずっと。',...(first?[{speaker:'廊下',text:'壁の向こうで、ゆっくりと、扉が開く音がした。'}]:[])],()=>{if(first){sound.play('door_open_1',{gain:.17,rate:.5,pan:-.7});toast('廊下に、なかったはずの扉が現れた');}});
   }break;
  case 'bed':
   if(state.flags.bed){say(['妹の枕は、まだ温かい。\n誰かがここに戻ってくるのを、家が待っている。']);break;}
   state.flags.bed=true;addItem(state,'tapeB');save();updateHud();
   say(['妹の枕の下に、カセットテープが隠されていた。\nラベルには、小さな字で「B」。',{speaker:'入手',text:'「カセットテープ B」を手に入れた。\n二本のテープを、書斎のレコーダーで聴こう。'},'枕から手を離すと、背中のほうで、布団が沈む音がした。'],()=>{sound.play('cloth_1',{gain:.2,rate:.42,pan:.85});whisper('この部屋に入ってきたのは、ひとりだった。');});break;
  case 'diary':record('diary',[{speaker:'澪の日記',text:'おねえちゃんへ。\nあれは、よんでもこない。へんじをすると、くる。'},{speaker:'澪の日記',text:'わたしのこえがしても、なまえをよばないで。\nむかえにきたら、いつものように、てをだして。\nわたしのてがつめたくても、はなさないで。'}]);break;
  case 'mirror':
   if(!state.flags.mirror){state.flags.mirror=true;save();say(['鏡の中の私は、私が止まってから、少し遅れて止まった。','目を閉じる前に、鏡の中の私が目を閉じた。']);}
   else say(['もう、鏡を見るのはやめよう。']);break;
  case 'last-page':record('lastPage',[{speaker:'最後の記録',text:'家は、返事しか持っていない。\n呼びかけることはできても、先に手を差し出すことはできない。'},{speaker:'最後の記録',text:'沈黙は、拒絶ではない。\nあの子と交わした、最初の約束だった。'}]);break;
  case 'threshold':
   say([{speaker:'鏡の向こう',text:'「おねえちゃん。\n迎えに、きてくれたの？」'},'鏡の向こうに、妹が立っている。\nその後ろには、私と同じ顔がいくつも並んでいた。',{speaker:'最後の返事',text:state.notes.includes('diary')?'澪の日記を思い出す。\n名前を呼ばないで。いつものように、手を出して。':'声をかければ、届きそうな距離だ。\nでも、妹と交わした約束を、まだ思い出せない。',choices:[{label:'「澪。迎えにきたよ」と答える',run:()=>finish('answer')},...(state.notes.includes('diary')?[{label:'何も言わず、手を差し出す',run:()=>finish('hand')}]:[]),{label:'まだ、決められない',run:()=>{whisper('子供部屋に、まだ読んでいない言葉があるかもしれない。');}}]}]);break;
  case 'exit':
   if(!state.inventory.includes('key'))say(['玄関の扉は、内側から開かない。\n家の奥で、妹が私の帰りを待っている気がする。']);
   else say(['玄関の鍵が、いつの間にか開いている。\n今なら、ひとりで帰れる。',{speaker:'玄関の扉',text:'ここで、家を出ますか？',choices:[{label:'ひとりで家を出る',run:()=>finish('leave')},{label:'妹を探し続ける',run:()=>{}}]}]);break;
 }
}
function finish(choice){
 const id=endingFor(choice,state),ending=ENDINGS[id];state.ending=id;save();mode='ending';hide('hud');hide('dialogue');sound.stopAmbient();clearInputs();
 const found=getStorage(ENDINGS_KEY,[]),list=Array.isArray(found)?found:[];if(!list.includes(id))list.push(id);setStorage(ENDINGS_KEY,list);
 $('ending').innerHTML=`<section class="ending-inner"><span class="ending-index">ENDING ${ending.index} / 03</span><h2>${ending.title}</h2><p>${ending.body}</p><p class="ending-footnote">${ending.foot}</p><div class="modal-actions"><button class="text-button" id="ending-continue">最後の選択から</button><button class="text-button" id="ending-title">タイトルへ</button></div><p class="fine-print">見つけた結末 ${list.length} / 3</p></section>`;show('ending');
 $('ending-continue').onclick=()=>startGame(true);$('ending-title').onclick=toTitle;$('ending-continue').focus({preventScroll:true});
}
function toggleLight(){if(mode!=='play'||dialogue||modalType||transitioning)return;state.light=!state.light;sound.play('metal_click',{gain:.1,rate:1.1});updateHud();}
function doInteract(){if(dialogue){advanceDialogue();return;}if(nearest)interact(nearest.id);else if(mode==='play')toast('光る場所の近くで調べられます');}
$('interact-button').onclick=doInteract;$('touch-interact').onclick=doInteract;$('touch-light').onclick=toggleLight;
function findWalkable(x,y){
 let best=null,d=Infinity;
 for(let yy=248;yy<560;yy+=16)for(let xx=104;xx<920;xx+=16){if(!canWalk(state.room,xx,yy))continue;const dist=Math.hypot(xx-x,yy-y);if(dist<d){d=dist;best={x:xx,y:yy};}}
 return best||{x:512,y:500};
}
function routeTo(x,y,action=null){
 if(mode!=='play'||dialogue||modalType||transitioning)return;
 const target=findWalkable(x,y),start=findWalkable(state.x,state.y),key=(x,y)=>x+','+y;
 const queue=[start],seen=new Map([[key(start.x,start.y),null]]);let found=null,qi=0;
 while(qi<queue.length){
  const n=queue[qi++];if(Math.hypot(n.x-target.x,n.y-target.y)<12){found=n;break;}
  for(const [dx,dy] of [[16,0],[-16,0],[0,16],[0,-16]]){
   const xx=n.x+dx,yy=n.y+dy,k=key(xx,yy);if(seen.has(k)||!canWalk(state.room,xx,yy)||!canWalk(state.room,n.x+dx/2,n.y+dy/2))continue;
   seen.set(k,n);queue.push({x:xx,y:yy});
  }
 }
 if(!found){toast('そこへは近づけない。別の方向から回り込もう。');return;}
 path=[];let n=found;while(n){path.unshift(n);n=seen.get(key(n.x,n.y));}pathAction=action;
}
$('scene').addEventListener('pointerdown',e=>{
 if(mode!=='play'||dialogue||modalType||transitioning)return;
 const p=renderer.screenToWorld(e.clientX,e.clientY);
 const h=getHotspots(state.room,state).filter(h=>Math.hypot(h.x-p.x,h.y-p.y)<60).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
 if(h&&Math.hypot(h.x-state.x,h.y-state.y)<h.r){interact(h.id);return;}
 routeTo(h?.x??p.x,h?.y??p.y,h?.id??null);
});
addEventListener('keydown',e=>{
 const key=e.key.toLowerCase();
 if(key==='tab'&&(modalType||dialogue)){
  const container=modalType?$('modal'):$('dialogue'),focusable=[...container.querySelectorAll('button:not(.hidden),input,a[href]')].filter(el=>!el.disabled&&el.offsetParent!==null);
  const first=focusable[0],last=focusable.at(-1);if(first&&last){if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}return;
 }
 if(key==='escape'){
  e.preventDefault();if(e.repeat)return;if(modalType)closeModal();else if(mode==='play')openSettings(true);else if(mode==='ending')toTitle();return;
 }
 if(modalType||/INPUT|TEXTAREA/.test(e.target.tagName))return;
 if(mode!=='play')return;
 if(['arrowup','arrowdown','arrowleft','arrowright',' ','enter','e','w','a','s','d','f','j','m','shift'].includes(key))e.preventDefault();
 if(e.repeat&&['e','enter',' ','f','j','m'].includes(key))return;
 if(key==='e'||key==='enter'||key===' '){doInteract();return;}
 if(key==='j'||key==='m'){if(!dialogue)openJournal(key==='m'?'map':'notes');return;}
 if(key==='f'){toggleLight();return;}
 if(!dialogue){keys.add(key);path=[];pathAction=null;}
});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
addEventListener('blur',()=>{clearInputs();if(mode==='play'&&!modalType)openSettings(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInputs();sound.suspend();if(mode==='play'&&!modalType)openSettings(true);}});
for(const b of document.querySelectorAll('[data-key]')){
 b.addEventListener('pointerdown',e=>{e.preventDefault();if(dialogue||modalType)return;b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);path=[];pathAction=null;});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,()=>keys.delete(b.dataset.key));
}
function update(dt){
 elapsed+=dt;
 if(mode!=='play'||modalType||transitioning){moving=false;return;}
 if(dialogue){
  moving=false;const p=dialogue.pages[dialogue.index];if(dialogue.typed<p.text.length){dialogTimer+=dt;const n=Math.floor(dialogTimer*36);if(n>0){dialogue.typed=Math.min(p.text.length,dialogue.typed+n);dialogTimer=0;$('dialogue-text').textContent=p.text.slice(0,dialogue.typed);}}return;
 }
 state.time+=dt;
 let dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
 if(path.length&&!dx&&!dy){
  const p=path[0],dist=Math.hypot(p.x-state.x,p.y-state.y);
  if(dist<3){state.x=p.x;state.y=p.y;path.shift();if(!path.length&&pathAction){const id=pathAction;pathAction=null;const target=getHotspots(state.room,state).find(h=>h.id===id);if(target&&Math.hypot(target.x-state.x,target.y-state.y)<=target.r)interact(id);return;}}
  else {dx=(p.x-state.x)/dist;dy=(p.y-state.y)/dist;}
 }
 moving=!!(dx||dy);
 if(moving){
  const magnitude=Math.hypot(dx,dy);dx/=magnitude;dy/=magnitude;
  const run=keys.has('shift'),speed=run?131:88;const mx=dx*speed*dt,my=dy*speed*dt;let moved=false;
  if(canWalk(state.room,state.x+mx,state.y)){state.x+=mx;moved=true;}if(canWalk(state.room,state.x,state.y+my)){state.y+=my;moved=true;}
  if(Math.abs(dx)>Math.abs(dy))state.dir=dx<0?1:2;else state.dir=dy<0?3:0;
  moving=moved;if(!moved&&path.length){path=[];pathAction=null;}
  stepTimer+=dt;if(moved&&stepTimer>(run?.24:.4)){stepTimer=0;if(state.room!=='echo')sound.step(stepIndex++,run);}
 }
 updateThreat(dt);
 const hotspots=getHotspots(state.room,state);nearest=hotspots.filter(h=>Math.hypot(h.x-state.x,h.y-state.y)<h.r).sort((a,b)=>Math.hypot(a.x-state.x,a.y-state.y)-Math.hypot(b.x-state.x,b.y-state.y))[0]||null;
 if(nearest&&!threat){show('interaction');$('interaction-label').textContent=nearest.label;}else hide('interaction');
 ambientTimer+=dt;
 if(ambientTimer>21&&!threat){ambientTimer=0;if(state.room!=='echo')sound.distant();if(state.room==='hall'&&state.inventory.includes('key')&&!state.flags.threatDone)whisper('いま、もうひとつ、足音がした。',4400);}
}
function frame(time){const dt=Math.min(.05,Math.max(0,(time-lastTime)/1000));lastTime=time;update(dt);renderer.draw(state,{mode,settings,nearest,threat,moving,dialogue},dt);requestAnimationFrame(frame);}
async function boot(){
 try{await renderer.load();hide('loading');updateContinue();requestAnimationFrame(frame);}
 catch(e){$('loading-status').textContent=e.message+'。再読み込みしてください。';console.error(e);}
}
// Read-only instrumentation is limited to Vite development and used by browser tests.
if(import.meta.env.DEV)window.__house={snapshot:()=>structuredClone({state,mode,modalType,dialogue:dialogue?{index:dialogue.index,count:dialogue.pages.length,choices:!!dialogue.pages[dialogue.index].choices}:null,threat,nearest,pathLength:path.length}),screenPoint:(x,y)=>({x:(x+renderer.offsetX)*renderer.scale,y:(y+renderer.offsetY)*renderer.scale}),hotspots:()=>getHotspots(state.room,state),walkable:(x,y)=>canWalk(state.room,x,y)};
boot();
