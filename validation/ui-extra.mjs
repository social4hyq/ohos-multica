import {connect} from './cdp.mjs';import fs from 'node:fs';const c=await connect();const sleep=ms=>new Promise(r=>setTimeout(r,ms));const out=[];
try{
 await c.evaluate('document.querySelector("input[role=combobox]").focus()');await c.send('Input.insertText',{text:'POLA-14'});await sleep(1500);
 let text=await c.evaluate('document.body.innerText');out.push({test:'desktop.global-search',status:text.includes('OHOS 本地代码读写及测试验收')?'PASS':'FAIL',evidence:text.slice(-1800)});
 await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await sleep(500);
 await c.evaluate('document.querySelector("a[aria-label=设置]").click()');await sleep(700);
 console.log('settings links',await c.evaluate(`Array.from(document.querySelectorAll('a')).filter(e=>e.getBoundingClientRect().width>0).map(e=>({text:e.innerText,href:e.getAttribute('href')}))`));
 console.log('search',out);
}finally{fs.writeFileSync(new URL('./ui-extra-results.json',import.meta.url),JSON.stringify(out,null,2));c.close()}
