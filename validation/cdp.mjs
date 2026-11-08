export async function connect(){
 const targets=await (await fetch('http://127.0.0.1:19225/json/list')).json();
 const target=targets.find(t=>t.type==='page'&&t.url.startsWith('file:'));
 if(!target)throw Error('Multica renderer not found');
 const ws=new WebSocket(target.webSocketDebuggerUrl);let seq=0;const pending=new Map();
 ws.onmessage=e=>{const d=JSON.parse(e.data);if(pending.has(d.id)){const {resolve,reject,timer}=pending.get(d.id);clearTimeout(timer);pending.delete(d.id);d.error?reject(Error(JSON.stringify(d.error))):resolve(d.result)}};
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method))},20000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}))});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 return {send,evaluate,close:()=>ws.close()};
}
if(process.argv[1]===new URL(import.meta.url).pathname){const c=await connect();try{console.log(JSON.stringify(await c.evaluate(process.argv[2]||'document.body.innerText'),null,2))}finally{c.close()}}
