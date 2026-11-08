import json,subprocess,time
from pathlib import Path
root=Path(__file__).resolve().parent;s=json.loads((root/'state.json').read_text())
cli=[str(Path.home()/'.local/bin/multica'),'--profile','desktop-api.multica.ai'];rows=[]
for name,id in s['agent_issues'].items():
 runs=json.loads(subprocess.check_output(cli+['issue','runs',id,'--output','json']))
 r=runs[0];result=(r.get('result') or {}).get('output','')
 row={'agent':name,'issue':id,'run':r['id'],'status':r['status'],'error':r.get('error'),'output':result[:1500]}
 rows.append(row);print(json.dumps(row,ensure_ascii=False),flush=True)
(root/'agent-results.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
