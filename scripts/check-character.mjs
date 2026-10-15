import {chromium as pw} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import chromium,{inflate} from '@sparticuz/chromium';
await inflate('node_modules/@sparticuz/chromium/bin/al2023.tar.br');
const browser=await pw.launch({headless:true,executablePath:await chromium.executablePath(),args:chromium.args,env:{...process.env,LD_LIBRARY_PATH:'/tmp/al2023/lib'}});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173');await page.locator('#loading').waitFor({state:'hidden'});
await page.locator('#new-game').click();
// Advance from the opening narration to the player's dialogue portrait.
for(let i=0;i<6;i++){
 const snap=await page.evaluate(()=>window.__house.snapshot());
 if(snap.dialogue?.index===1)break;
 await page.keyboard.press('e');
}
await page.locator('.dialogue-portrait img').evaluate(im=>im.decode());
const portrait=await page.locator('.dialogue-portrait img').getAttribute('src');
if(!portrait.includes('girl-front.svg?v=8'))throw new Error('Stale portrait asset');
await page.locator('.dialogue-portrait').screenshot({path:'/home/user/dialogue-portrait-fixed.png'});
for(let i=0;i<15;i++){const d=await page.evaluate(()=>window.__house.snapshot().dialogue);if(!d)break;await page.keyboard.press('e');}
await page.keyboard.down('d');await page.waitForTimeout(550);await page.keyboard.up('d');
const right=await page.evaluate(()=>window.__house.snapshot());
if(right.state.dir!==2)throw new Error('Right direction not applied');
const imageOk=await page.evaluate(async()=>{const im=new Image();im.src='/assets/character/girl-walk.svg?v=8';await im.decode();return [im.naturalWidth,im.naturalHeight];});
await page.keyboard.down('a');await page.waitForTimeout(550);await page.keyboard.up('a');
const left=await page.evaluate(()=>window.__house.snapshot());
if(left.state.dir!==1)throw new Error('Left direction not applied');
if(! (right.state.x>531 && left.state.x<right.state.x))throw new Error('Character did not move');
console.log(JSON.stringify({portrait,svgSize:imageOk,right:{direction:right.state.dir,x:right.state.x},left:{direction:left.state.dir,x:left.state.x},errors},null,2));
const canvasPNG=await page.evaluate(()=>document.querySelector('#scene').toDataURL('image/png'));
writeFileSync('/home/user/character-canvas-verified.png',Buffer.from(canvasPNG.split(',')[1],'base64'));
await browser.close();
