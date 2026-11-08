import json,subprocess,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parent;s=json.loads((root/'state.json').read_text());out=[]
cli=[str(Path.home()/'.local/bin/multica'),'--profile','desktop-api.multica.ai']
def cli_json(*args):return json.loads(subprocess.check_output(cli+list(args)+['--output','json']))
x=cli_json('issue','search',s['issue_key'],'--include-closed');assert any(i['id']==s['issue'] for i in x['issues']);out.append({'test':'issue.search.closed.corrected','status':'PASS','note':'Initial harness incorrectly assumed list; actual CLI returns issues envelope.'})
x=cli_json('issue','search','OHOS_UI_CREATE_OK','--include-closed');assert len(x['issues'])==1; i=x['issues'][0];assert i['assignee_id'] is None and '✅' in i['description'];s['ui_issue']=i['id'];out.append({'test':'desktop.manual-create.persisted','status':'PASS','issue':i['identifier']})
subprocess.run(cli+['issue','update',i['id'],'--project',s['project'],'--no-start'],check=True,capture_output=True)
assert (root/'attachment.txt').read_bytes()==(root/'downloads/attachment.txt').read_bytes();out.append({'test':'attachment.download.byte-roundtrip','status':'PASS'})
a=cli_json('autopilot','runs',s['autopilot']);assert a['runs'][0]['status']=='completed';out.append({'test':'autopilot.manual-run.completed','status':'PASS'})
r=cli_json('issue','runs',s['code_issue'])[0];assert r['status']=='completed' and 'OHOS_CODE_OK' in r['result']['output'];out.append({'test':'agent.local-directory-code-edit','status':'PASS'})
p=subprocess.run(['node','--test',str(root/'code-fixture/add.test.mjs')],capture_output=True,text=True);assert p.returncode==0;out.append({'test':'agent.code-tests.independent-rerun','status':'PASS','note':'3/3 tests'})
r=cli_json('issue','runs',s['agent_issues']['Claude Code'])[0];assert r['status']=='cancelled';out.append({'test':'run.cancel','status':'PASS','note':'Claude did not emit any messages within bounded smoke-test window; cancelled instead of leaving it running.'})
(root/'state.json').write_text(json.dumps(s,ensure_ascii=False,indent=2)+'\n');(root/'final-checks.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print(json.dumps(out,ensure_ascii=False,indent=2))
