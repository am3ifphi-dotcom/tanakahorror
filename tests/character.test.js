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
test('dialogue portrait uses the cleaned, versioned SVG rather than the stale icon',()=>{
 const html=fs.readFileSync('index.html','utf8');
 assert.match(html,/class="dialogue-portrait"><img src="\/assets\/character\/girl-front\.svg\?v=6"/);
 assert.doesNotMatch(html,/src="\/assets\/girl\.png"/);
});
