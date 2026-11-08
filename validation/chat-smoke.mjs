import {connect} from './cdp.mjs';import fs from 'node:fs';const c=await connect();
try{
 await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await c.evaluate('document.querySelector("[contenteditable=true]").focus()');
 await c.send('Input.insertText',{text:'这是聊天验收。请仅回复 OHOS_CHAT_OK，不调用工具、不修改文件、不创建任务。'});
 console.log('editor',await c.evaluate('document.querySelector("[contenteditable=true]").innerText'));
 await c.evaluate('document.querySelector("button[aria-label=发送]").click()');
 await new Promise(r=>setTimeout(r,1500));const text=await c.evaluate('document.body.innerText');console.log(text);fs.writeFileSync(new URL('./chat-sent.txt',import.meta.url),text);
}finally{c.close()}
