import json, subprocess, time
from pathlib import Path
ROOT=Path(__file__).resolve().parent
CLI=[str(Path.home()/'.local/bin/multica'),'--profile','desktop-api.multica.ai']
results=[]; state={}; stamp=time.strftime('%Y%m%d-%H%M%S')
def save():
 (ROOT/'api-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
 (ROOT/'state.json').write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n')
def call(name,*args,check=None):
 p=subprocess.run(CLI+list(args),text=True,capture_output=True,cwd=ROOT,timeout=60)
 try: value=json.loads(p.stdout)
 except ValueError: value=p.stdout.strip()
 ok=p.returncode==0
 error=p.stderr.strip() if not ok else ''
 if ok and check:
  try: assert check(value)
  except Exception as e:ok=False;error=f'assertion failed: {e}'
 results.append({'test':name,'status':'PASS' if ok else 'FAIL','error':error[:1500]})
 print(results[-1],flush=True);save()
 return value if p.returncode==0 else None
p=call('project.create','project','create','--title',f'OHOS 验收 {stamp}','--description','自动化验收专用项目，不含真实业务数据','--output','json');state['project']=p['id'];save()
i=call('issue.create','issue','create','--title',f'OHOS 验收基础功能 {stamp}','--project',p['id'],'--description','中文 Unicode ✅\n第二行','--output','json');state['issue']=i['id'];state['issue_key']=i['identifier'];save()
call('issue.update','issue','update',i['id'],'--title',f'OHOS 验收已更新 {stamp}','--priority','high','--no-start','--output','json',check=lambda x:x['priority']=='high')
call('issue.read','issue','get',i['id'],'--output','json',check=lambda x:'中文 Unicode' in x['description'])
call('issue.status.started','issue','status',i['id'],'in_progress')
call('issue.status.done','issue','status',i['id'],'done')
call('issue.read.done','issue','get',i['id'],'--output','json',check=lambda x:x['status']=='done')
c=call('comment.create','issue','comment','add',i['id'],'--content','验收评论 **Markdown** ✅','--output','json');state['comment']=c['id'];save()
call('comment.update','issue','comment','update',c['id'],'--content','验收评论更新 ✅','--expected-revision',str(c.get('revision',1)),'--output','json')
call('comment.read','issue','comment','list',i['id'],'--output','json',check=lambda xs:any(x.get('content')=='验收评论更新 ✅' for x in xs))
child=call('issue.child.create','issue','create','--title',f'OHOS 验收子任务 {stamp}','--project',p['id'],'--parent',i['id'],'--output','json');state['child']=child['id'];save()
call('issue.child.read','issue','children',i['id'],'--output','json')
call('issue.search','issue','search',f'OHOS 验收已更新 {stamp}','--output','json')
l=call('label.create','label','create','--name',f'ohos-qa-{stamp}','--color','#3b82f6','--output','json');state['label']=l['id'];save()
call('label.attach','issue','label','add',i['id'],l['id'],'--output','json')
call('label.read','issue','label','list',i['id'],'--output','json',check=lambda xs:any(x['id']==l['id'] for x in xs))
prop=call('property.create','property','create','--name',f'OHOS-QA-{stamp}','--type','text','--output','json');state['property']=prop['id'];save()
call('property.set','issue','property','set',i['id'],'--name',prop['id'],'--value','中文属性✅','--output','json')
call('property.read','issue','property','list',i['id'],'--output','json')
call('subscriber.add','issue','subscriber','add',i['id'],'--output','json')
call('subscriber.read','issue','subscriber','list',i['id'],'--output','json')
call('subscriber.remove','issue','subscriber','remove',i['id'],'--output','json')
(ROOT/'attachment.txt').write_text('Multica OHOS attachment roundtrip 验收 ✅\n')
call('attachment.upload','issue','update',i['id'],'--attachment','attachment.txt','--no-start','--output','json')
w=call('workflow.create','workflow','create','--name',f'OHOS-QA-{stamp}','--description','验收专用，不修改默认工作流','--output','json');state['workflow']=w['id'];save()
call('workflow.read','workflow','get',w['id'],'--output','json')
call('workflow.project.set','project','workflow','set',p['id'],w['id'],'--output','json')
call('workflow.project.read','project','workflow','get',p['id'],'--output','json')
agents=call('agents.read','agent','list','--output','json');state['agents']={a['name']:a['id'] for a in agents};state['agent_issues']={};save()
for a in agents:
 test=call('agent.dispatch.'+a['name'],'issue','create','--title',f'OHOS 验收 {a["name"]} {stamp}','--project',p['id'],'--assignee-id',a['id'],'--description',f'最小集成验收：不要修改项目文件，不执行代码、不访问外网、不创建子任务。只需回复“OHOS_QA_OK {a["name"]}”，并通过 Multica 将此任务置为 done。若运行时不支持工具则直接回复该句。不要继续其他工作。','--output','json')
 if test:state['agent_issues'][a['name']]=test['id'];save()
print('API phase complete',flush=True)
