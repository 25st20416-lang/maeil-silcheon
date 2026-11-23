import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
// 원본 문서도 동기화하되 다운로드에는 현재 Worker 알림 구성을 포함한다.
writeFileSync('public/index.html',readFileSync('index.html'));
mkdirSync('.baze-files/outputs',{recursive:true});
const python=`
import zipfile,pathlib
root=pathlib.Path('.')
out=root/'.baze-files/outputs/매일실천_예약알림_소스.zip'
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,strict_timestamps=False) as z:
 for folder in ['public','worker','scripts','src','.github']:
  for p in (root/folder).rglob('*'):
   if p.is_file() and 'node_modules' not in p.parts:z.write(p,p.as_posix())
 for name in ['index.html','README.md','package.json','package-lock.json','vite.config.ts','wrangler.jsonc','baze.json','schema.sql','tsconfig.notifications.json','worker-env.d.ts','.gitignore']:
  z.write(root/name,name)
print(str(out),out.stat().st_size,'bytes')
with zipfile.ZipFile(out) as check:
 assert check.testzip() is None
 assert not any(n.endswith(('.env','.dev.vars','.pem','.key')) for n in check.namelist())
 print('Archive integrity passed:',len(check.infolist()),'files')
`;
const result=spawnSync('python3',['-c',python],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
