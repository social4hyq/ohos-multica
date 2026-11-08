import {connect} from './cdp.mjs';const c=await connect();try{
 await c.evaluate('document.querySelector("[contenteditable=true][aria-label=任务标题]").focus()');await c.send('Input.insertText',{text:'OHOS_UI_CREATE_OK 验收专用'});
 await c.evaluate(`document.querySelector('p[data-placeholder="添加描述..."]').closest('[contenteditable=true]').focus()`);await c.send('Input.insertText',{text:'通过真实桌面编辑器输入中文和 ✅，未指派 agent。'});
 console.log(await c.evaluate(`[...document.querySelectorAll('[role=dialog] button')].filter(e=>e.getBoundingClientRect().width>0).map(e=>({text:e.innerText,aria:e.getAttribute('aria-label'),disabled:e.disabled}))`));
 await c.evaluate(`(()=>{const e=[...document.querySelectorAll('[role=dialog] button')].find(e=>e.getBoundingClientRect().width>0&&/^创建\n/.test(e.innerText)&&!e.disabled);if(!e)throw Error('create button missing');e.click();return true})()`);
 await new Promise(r=>setTimeout(r,1500));console.log(await c.evaluate('document.body.innerText.slice(-1200)'));
}finally{c.close()}
