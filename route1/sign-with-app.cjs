// Local experiment: reuse the installed DevEco CLI's signing-material decoder.
// Passwords stay in memory and are never written to the experiment logs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
const ts=require('/storage/Users/currentUser/HarmonyPC/Software/ohos-multica/source-minimal/apps/desktop/node_modules/typescript');
const sdk='/data/storage/el2/base/cache/deveco-cli-view/inst/node_modules/@deveco/deveco-cli-openharmony-arm64/dist/cli.js';
const text=fs.readFileSync(sdk,'utf8'),sf=ts.createSourceFile('sdk.js',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);let code;
function walk(n){if(ts.isVariableDeclaration(n)&&n.name.getText(sf)==='Rs'&&ts.isClassExpression(n.initializer))code=n.initializer.getText(sf);ts.forEachChild(n,walk)}walk(sf);
if(!code?.includes('static decryptPwd('))throw Error('Installed SDK signing decoder changed; stop rather than guessing');
const decoder=vm.runInNewContext('('+code+')',{Buffer,Int8Array,W:path,Um:crypto,we:fs,m:()=>{}});
const material=JSON.parse(fs.readFileSync('/data/storage/el2/base/cache/electron-ohos/libelectron/ohos_hap/build-profile.json5','utf8')).app.signingConfigs[0].material;
const config=path.join(process.env.HOME,'.ohos/config');
const storePwd=decoder.decryptPwd(config,material.storePassword,'storePassword');
const keyPwd=decoder.decryptPwd(config,material.keyPassword,'keyPassword');
const args=['sign','-keyAlias',material.keyAlias,'-keyPwd',keyPwd,'-keystorePwd',storePwd,'-appCertFile',material.certpath,'-profileFile',material.profile,'-keystoreFile',material.storeFile,'-signAlg',material.signAlg,'-inFile',process.argv[2],'-outFile',process.argv[3]];
const hap=process.argv[4]==='hap';
if(hap)args.splice(0,1,'sign-app','-mode','localSign','-compatibleVersion','26','-signCode','1');
const r=spawnSync(hap?'hap-sign-tool':'binary-sign-tool',args,{input:'',encoding:'utf8',timeout:30000});
let log=(r.stdout||'')+(r.stderr||'');for(const secret of [storePwd,keyPwd])if(secret)log=log.split(secret).join('[redacted]');
process.stdout.write(log);if(r.error)console.error(r.error.message);process.exitCode=r.status??1;
