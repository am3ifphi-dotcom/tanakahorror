import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('SVG masters use a real pixel grid with no blur or external dependencies',()=>{
 for(const side of ['front','left','right','back']){
  const svg=fs.readFileSync(`public/assets/character/girl-${side}.svg`,'utf8');
  assert.match(svg,/viewBox="0 0 60 60"/);assert.match(svg,/shape-rendering="crispEdges"/);
  assert.ok((svg.match(/<rect /g)||[]).length>300);assert.doesNotMatch(svg,/<image|<filter|feGaussianBlur|opacity=/);
 }
});
test('game consumes the SVG animation, not the obsolete squeezed sprite',()=>{
 const renderer=fs.readFileSync('src/renderer.js','utf8');assert.match(renderer,/assets\/character\/girl-walk.svg/);
 const sheet=fs.readFileSync('public/assets/character/girl-walk.svg','utf8');assert.match(sheet,/viewBox="0 0 240 240"/);
 const source=fs.readFileSync('scripts/prepare-character.py','utf8');assert.doesNotMatch(source,/resize\(\(51,60\)/);
});
test('left and right are distinct SVG pixel arrangements',()=>{
 const left=fs.readFileSync('public/assets/character/girl-left.svg','utf8');
 const right=fs.readFileSync('public/assets/character/girl-right.svg','utf8');assert.notEqual(left,right);
});
test('side views are built from the supplied girl_left/girl_right drawings, not synthesised',()=>{
 const source=fs.readFileSync('scripts/prepare-character.py','utf8');
 assert.match(source,/girl_left\.png/);assert.match(source,/girl_right\.png/);
 assert.doesNotMatch(source,/FLIP_LEFT_RIGHT/);assert.doesNotMatch(source,/def make_profile/);
});
test('torch glow follows the facing direction instead of sitting on one side',()=>{
 const renderer=fs.readFileSync('src/renderer.js','utf8');
 assert.doesNotMatch(renderer,/createRadialGradient\(x\+17,y-16/);
 assert.match(renderer,/const TORCH_HAND=\[\[[-\d.]+,[-\d.]+\],\[-[\d.]+,[-\d.]+\],\[[\d.]+,[-\d.]+\],\[[-\d.]+,[-\d.]+\]\]/);
 assert.match(renderer,/TORCH_HAND\[dir\]/);assert.match(renderer,/FACING\[dir\]/);
});
test('the background shows between the legs instead of the supplied white matte',()=>{
 for(const view of ['front','back']){
  const svg=fs.readFileSync(`public/assets/character/girl-${view}.svg`,'utf8');
  const filled=Array.from({length:60},()=>new Array(60).fill(false));
  for(const m of svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="1"/g)){
   const x=+m[1],y=+m[2],w=+m[3];for(let i=0;i<w;i++)filled[y][x+i]=true;
  }
  const slit=[];
  for(let y=45;y<59;y++){
   const row=filled[y],first=row.indexOf(true),last=row.lastIndexOf(true);
   if(first<0)continue;
   for(let x=Math.max(first+1,24);x<Math.min(last,37);x++)if(!row[x]){slit.push(y);break;}
  }
  assert.ok(slit.length>=5,`${view}: the legs are still fused by the white matte (rows ${slit})`);
 }
});
test('every stored frame is unique: the standing art is walk frame 0, not a copy',()=>{
 const dir='public/assets/character';
 const files=fs.readdirSync(dir).filter(f=>f.endsWith('.png'));
 assert.equal(files.length,16,`expected 4 directions x 4 frames, got ${files}`);
 const seen=new Map();
 for(const f of files){
  const key=fs.readFileSync(`${dir}/${f}`).toString('base64');
  assert.ok(!seen.has(key),`${f} is a byte-for-byte copy of ${seen.get(key)}`);
  seen.set(key,f);
 }
 for(const view of ['front','left','right','back']){
  assert.ok(fs.existsSync(`${dir}/girl-${view}.png`),`${view}: the standing drawing is frame 0`);
  assert.ok(!fs.existsSync(`${dir}/girl-${view}-walk-0.png`),`${view}: frame 0 must not be duplicated`);
  for(const f of [1,2,3])assert.ok(fs.existsSync(`${dir}/girl-${view}-walk-${f}.png`),`${view}: walk frame ${f} is missing`);
 }
 for(const gone of ['girl_idle.png','girl_back.png','girl_left.png','girl_right.png','public/assets/girl.png','public/assets/girl-walk.png'])
  assert.ok(!fs.existsSync(gone),`${gone} is a duplicate of a frame in public/assets/character`);
 for(const kept of ['source/girl_idle.png','source/girl_left.png','source/girl_right.png'])
  assert.ok(fs.existsSync(kept),`${kept}: the supplied artwork must stay`);
});
test('dialogue portrait uses the cleaned, versioned SVG rather than the stale icon',()=>{
 const html=fs.readFileSync('index.html','utf8');
 assert.match(html,/class="dialogue-portrait"><img src="\/assets\/character\/girl-front\.svg\?v=8"/);
 assert.doesNotMatch(html,/src="\/assets\/girl\.png"/);
});
