// Walks the heroine in all four directions with the torch on/off and dumps the
// composited #scene canvas for each state (plus meta.json) so the side sprites
// and the torch glow can be eyeballed. Needs `npm run dev -- --port 5173`.
// Usage: node scripts/capture-walk.mjs [outDir]   (default: test-results/walk)
import {chromium as pw} from '@playwright/test';
import chromium,{inflate} from '@sparticuz/chromium';
import {mkdirSync,writeFileSync} from 'node:fs';
const outDir=process.argv[2]||'test-results/walk';mkdirSync(outDir,{recursive:true});
await inflate('node_modules/@sparticuz/chromium/bin/al2023.tar.br');
const browser=await pw.launch({headless:true,executablePath:await chromium.executablePath(),args:chromium.args,env:{...process.env,LD_LIBRARY_PATH:'/tmp/al2023/lib'}});
const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
await page.goto('http://127.0.0.1:5173');await page.locator('#loading').waitFor({state:'hidden'});
await page.locator('#new-game').click();
for(let i=0;i<20;i++){const d=await page.evaluate(()=>window.__house.snapshot().dialogue);if(!d)break;await page.keyboard.press('e');await page.waitForTimeout(60);}
await page.waitForTimeout(300);
const meta={};
async function shot(name){
 // page.screenshot() stalls while the rAF loop runs, so read the canvas directly.
 const r=await page.evaluate(()=>{
  const s=window.__house.snapshot(),c=document.querySelector('#scene'),g=c.getContext('2d');
  const lum=(x0,y0,x1,y1)=>{const d=g.getImageData(x0,y0,x1-x0,y1-y0).data;let t=0;for(let i=0;i<d.length;i+=4)t+=d[i]*.299+d[i+1]*.587+d[i+2]*.114;return t/(d.length/4);};
  const x=Math.round(s.state.x),y=Math.round(s.state.y);
  return {state:s.state,dir:s.state.dir,png:c.toDataURL('image/png'),w:c.width,h:c.height,
   floor:{left:lum(x-150,y-60,x-50,y+20),right:lum(x+50,y-60,x+150,y+20),up:lum(x-40,y-160,x+40,y-80),down:lum(x-40,y+20,x+40,y+90)}};
 });
 writeFileSync(`${outDir}/${name}.png`,Buffer.from(r.png.split(',')[1],'base64'));
 meta[name]={x:r.state.x,y:r.state.y,dir:r.dir,light:r.state.light,w:r.w,h:r.h,floor:r.floor};
}
async function walk(key,ms){await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);await page.waitForTimeout(150);}
await page.keyboard.down('d');await page.waitForTimeout(450);await shot('walk-right-a');await page.waitForTimeout(65);await shot('walk-right-b');await page.waitForTimeout(65);await shot('walk-right-c');await page.keyboard.up('d');await page.waitForTimeout(150);
await shot('idle-right');
await page.keyboard.down('a');await page.waitForTimeout(450);await shot('walk-left-a');await page.waitForTimeout(65);await shot('walk-left-b');await page.waitForTimeout(65);await shot('walk-left-c');await page.keyboard.up('a');await page.waitForTimeout(150);
await shot('idle-left');
await walk('w',300);await shot('idle-up');
await walk('s',300);await shot('idle-down');
await page.keyboard.press('f');await page.waitForTimeout(150);await shot('idle-down-dark');
await walk('a',400);await shot('idle-left-dark');
await page.keyboard.press('f');await page.waitForTimeout(150);
writeFileSync(`${outDir}/meta.json`,JSON.stringify(meta,null,1));
// The torch pool must lead the heroine: facing right lights the right side, facing left the left.
const r=meta['idle-right'].floor,l=meta['idle-left'].floor;
const torchFollows=r.right>r.left+3&&l.left>l.right+3;
console.log(JSON.stringify({outDir,torchFollows,idleRight:r,idleLeft:l,errors}));
await browser.close();
if(!torchFollows||errors.length)process.exit(1);
