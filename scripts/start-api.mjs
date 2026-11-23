// 실제 비밀값은 자식 프로세스의 환경으로만 전달하고 파일에는 쓰지 않는다.
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { loadEnvFile } from 'node:process';
try { loadEnvFile(join(homedir(),'.config/factchat/project.env')); } catch {}
const root=resolve('.'),folder=mkdtempSync(join(tmpdir(),'maeil-api-'));
const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
config.main=resolve(config.main);config.assets.directory=resolve(config.assets.directory);
config.vars.NOTIFICATION_MODE='preview';
writeFileSync(join(folder,'wrangler.jsonc'),JSON.stringify(config));
const cache=join(homedir(),'.cache/baze');mkdirSync(cache,{recursive:true});
const keyFile=join(cache,'maeil-preview-notification-key');
if(!existsSync(keyFile))writeFileSync(keyFile,randomBytes(32).toString('hex'),{mode:0o600});
const secret=process.env.NOTIFICATION_SECRET||readFileSync(keyFile,'utf8');
mkdirSync('dist',{recursive:true});
const cli=resolve('node_modules/wrangler/bin/wrangler.js');
const args=['--config',join(folder,'wrangler.jsonc'),'--persist-to',resolve('.wrangler/state')];
const init=spawnSync(process.execPath,[cli,'d1','execute','DB','--local','--file',resolve('schema.sql'),...args],{stdio:'inherit',cwd:root});
if(init.status!==0)process.exit(init.status||1);
const child=spawn(process.execPath,[cli,'dev','--ip','0.0.0.0','--port','8787',...args],{stdio:'inherit',cwd:root,env:{...process.env,NOTIFICATION_SECRET:secret}});
process.on('SIGINT',()=>child.kill('SIGINT'));process.on('SIGTERM',()=>child.kill('SIGTERM'));
child.on('exit',code=>process.exit(code||0));
