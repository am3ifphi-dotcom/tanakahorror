import {chromium as pw} from '@playwright/test';import chromium from '@sparticuz/chromium';
const browser=await pw.launch({headless:true,executablePath:await chromium.executablePath(),args:chromium.args});
const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>console.log(e));
await page.goto('http://127.0.0.1:5173');console.log('loaded');await page.locator('#loading').waitFor({state:'hidden'});console.log('hidden');console.log(await page.evaluate(()=>({snapshot:window.__house.snapshot(),fonts:document.fonts.status,size:[innerWidth,innerHeight]})));
console.log(await page.evaluate(()=>document.querySelector('#scene').toDataURL().length));
await page.evaluate(()=>window.requestAnimationFrame=()=>{});console.log('stopped');
await page.screenshot({path:'/home/user/house-title.png',timeout:10000});console.log('captured');await browser.close();
