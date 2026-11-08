import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {stripTypeScriptTypes} from "node:module";
const root=process.env.MULTICA_TEST_SOURCE || new URL("../source-minimal/",import.meta.url).pathname;
const source=fs.readFileSync(root+"/apps/desktop/src/main/daemon-manager.ts","utf8");
function extract(name,next){const start=source.search(new RegExp("^(?:async )?function "+name+"\\(","m"));const end=source.indexOf("\n"+next,start);assert(start>=0&&end>start);return stripTypeScriptTypes(source.slice(start,end));}
function health(platform,transport){let nodeCalls=0,netCalls=0;const f=vm.runInNewContext(extract("fetchHealthAtPort","async function fetchProfileHealth")+";fetchHealthAtPort",{process:{platform},HEALTH_PROBE_TIMEOUT_MS:30,AbortController,setTimeout,clearTimeout,fetch:(...args)=>{nodeCalls++;return platform==="openharmony"?Promise.reject(Error("WebAssembly is not defined")):transport(...args)},net:{fetch:(...args)=>{netCalls++;return transport(...args)}}});return {f,calls:()=>({nodeCalls,netCalls})};}
const ok=async()=>({ok:true,json:async()=>({status:"running",pid:42})});
for(const platform of ["linux","darwin","win32"]){test(platform+" preserves global fetch",async()=>{const h=health(platform,ok);assert.deepEqual(JSON.parse(JSON.stringify(await h.f(19681))),{status:"running",pid:42});assert.deepEqual(h.calls(),{nodeCalls:1,netCalls:0});});}
test("OHOS health does not depend on undici/WebAssembly",async()=>{const h=health("openharmony",ok);assert.deepEqual(JSON.parse(JSON.stringify(await h.f(19681))),{status:"running",pid:42});assert.deepEqual(h.calls(),{nodeCalls:0,netCalls:1});});
for(const [name,transport] of [["non-200",async()=>({ok:false})],["invalid JSON",async()=>({ok:true,json:async()=>{throw Error("invalid")}})],["connection error",async()=>{throw Error("ECONNREFUSED")}],["abort timeout",async(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener("abort",()=>reject(Error("aborted"))))]]){
 test("OHOS "+name+" returns null",async()=>assert.equal(await health("openharmony",transport).f(19681,10),null));
}
for(const [platform,bin,wantState,wantPolls] of [["openharmony",null,"stopped",1],["linux",null,"cli_not_found",0],["darwin",null,"cli_not_found",0],["win32",null,"cli_not_found",0],["openharmony","/test/cli","stopped",1],["linux","/test/cli","stopped",1]]){
 test(`${platform} bootstrap with CLI ${!!bin}`,async()=>{let polls=0,states=[];const f=vm.runInNewContext(extract("bootstrapCli","function stopPolling")+";bootstrapCli",{process:{platform},resolveCliBinary:async()=>bin,sendStatus:s=>states.push(s.state),startPolling:()=>polls++});await f();assert.deepEqual(states,[wantState]);assert.equal(polls,wantPolls);});
}
