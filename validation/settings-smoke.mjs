import {connect} from './cdp.mjs';import fs from 'node:fs';const c=await connect(),out=[];const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 for(const tab of ['preferences','notifications','shortcuts','workflows','wakeups','labels','properties','quick-actions','code','channels','mcp','daemon','updates']){
  await c.evaluate(`(()=>{const e=[...document.querySelectorAll('a')].find(e=>e.getAttribute('href')?.endsWith('?tab=${tab}'));if(!e)throw Error('missing settings link');e.click();return true})()`);await sleep(700);
  const d=await c.evaluate(`({title:document.title,text:document.body.innerText.slice(-2500),headings:[...document.querySelectorAll('h1,h2,h3')].map(e=>e.innerText)})`);
  const ok=!/Application error|Something went wrong/.test(d.text)&&d.text.length>120;
  out.push({test:'desktop.settings.navigation.'+tab,status:ok?'PASS':'FAIL',...d});console.log(tab,ok,d.headings);
 }
}finally{fs.writeFileSync(new URL('./settings-results.json',import.meta.url),JSON.stringify(out,null,2));c.close()}
