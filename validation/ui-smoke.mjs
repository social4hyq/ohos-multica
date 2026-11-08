import {connect} from './cdp.mjs';import fs from 'node:fs';
const c=await connect();const results=[];const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 for(const [label,expected] of [['收件箱','收件箱'],['工作','任务'],['团队','Codex'],['自动化','OHOS-QA-'],['聊天','新对话']]){
  await c.evaluate(`(()=>{const e=[...document.querySelectorAll('a')].find(e=>e.innerText.trim()===${JSON.stringify(label)});if(!e)throw Error('missing nav');e.click();return true})()`);await sleep(1500);
  const text=await c.evaluate('document.body.innerText');const ok=text.includes(expected)&&!text.includes('Application error');results.push({test:'desktop.navigation.'+label,status:ok?'PASS':'FAIL',text:text.slice(0,2200)});console.log(label,ok);
 }
 console.log('Chat controls',await c.evaluate(`Array.from(document.querySelectorAll('button,input,textarea,[contenteditable=true]')).filter(e=>e.getBoundingClientRect().width>0).map(e=>({tag:e.tagName,text:e.innerText?.slice(0,65),aria:e.getAttribute('aria-label'),placeholder:e.getAttribute('placeholder'),role:e.getAttribute('role')}))`));
}finally{fs.writeFileSync(new URL('./ui-results.json',import.meta.url),JSON.stringify(results,null,2));c.close()}
