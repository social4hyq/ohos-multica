import {connect} from './cdp.mjs';import fs from 'node:fs';import {execFileSync,spawn} from 'node:child_process';
const c=await connect(),sleep=ms=>new Promise(r=>setTimeout(r,ms));const out=[];
const cli=process.env.HOME+'/.local/bin/multica';
try{
 const h=await (await fetch('http://127.0.0.1:19681/health')).json();if(h.active_task_count)throw Error('active tasks; no restart');
 await c.evaluate(`(()=>{document.querySelector('a[href$="?tab=daemon"]').click();return true})()`);await sleep(700);
 execFileSync(cli,['--profile','desktop-api.multica.ai','daemon','stop']);await sleep(6500);
 let text=await c.evaluate('document.body.innerText');out.push({test:'desktop.daemon-disconnect',status:text.includes('已停止')?'PASS':'FAIL',evidence:text.slice(-1600)});
 const fd=fs.openSync(process.env.HOME+'/.multica/logs/desktop-external-daemon.log','a');
 const p=spawn('setsid',['bash','/storage/Users/currentUser/HarmonyPC/Software/ohos-multica/scripts/start-daemon-ohos.sh','desktop-api.multica.ai'],{detached:true,stdio:['ignore',fd,fd]});p.unref();fs.closeSync(fd);const begun=Date.now();for(let k=0;k<30;k++){await sleep(2000);if((await c.evaluate('document.body.innerText')).includes('运行中'))break;}out.push({test:'reconnect-observation-window',status:'INFO',elapsed_ms:Date.now()-begun});
 text=await c.evaluate('document.body.innerText');const after=await (await fetch('http://127.0.0.1:19681/health')).json();
 out.push({test:'desktop.daemon-reconnect',status:text.includes('运行中')&&after.pid!==h.pid?'PASS':'FAIL',old_pid:h.pid,new_pid:after.pid,evidence:text.slice(-1500)});
 console.log(JSON.stringify(out,null,2));
}finally{fs.writeFileSync(new URL('./recovery-results.json',import.meta.url),JSON.stringify(out,null,2));c.close()}
