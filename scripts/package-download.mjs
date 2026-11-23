import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
// Firebase Hosting and Vite share the same application document.
writeFileSync('public/index.html',readFileSync('index.html'));
mkdirSync('.baze-files/outputs',{recursive:true});
const python=`
import zipfile,pathlib,json
root=pathlib.Path('.')
out=root/'.baze-files/outputs/매일실천_설정화면_배포용.zip'
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 for folder in ['public','functions']:
  for p in (root/folder).rglob('*'):
   if p.is_file() and 'node_modules' not in p.parts:z.write(p,p.as_posix())
 for name in ['index.html','firebase.json','firestore.rules','.firebaserc','배포안내.md','배포준비_확인사항.md']:
  z.write(root/name,name)
 z.writestr('README.md',(root/'배포준비_확인사항.md').read_text()+'\\n상세 Firebase 배포 절차는 배포안내.md를 확인해 주세요.\\n')
 z.writestr('package.json',json.dumps({'name':'daily-practice','version':'1.1.0','private':True,'type':'module','scripts':{'dev':'vite --host 0.0.0.0','build':'vite build','preview':'vite preview --host 0.0.0.0'},'devDependencies':{'vite':'^7.1.5'}},ensure_ascii=False,indent=2))
 z.writestr('vite.config.js',"import {defineConfig} from 'vite';export default defineConfig({server:{host:'0.0.0.0',allowedHosts:true}});\\n")
print(str(out),out.stat().st_size,'bytes')
with zipfile.ZipFile(out) as check:
 assert check.testzip() is None
 print('Archive integrity passed:',len(check.infolist()),'files')
`;
const result=spawnSync('python3',['-c',python],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
