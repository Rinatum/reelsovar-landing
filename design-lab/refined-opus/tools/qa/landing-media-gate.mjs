import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {verify} from './landing-media/verify.mjs';

const self=fileURLToPath(import.meta.url), project=resolve(dirname(self),'../..');
const args=process.argv.slice(2);
if (args.includes('--help')) {
  console.log('node tools/qa/landing-media-gate.mjs\nRequires the existing Chrome/CDP :9222 and local server :8720.\nBuild landing/site/ first. All eight suites run sequentially under the shared browser lock.\nReports: refinements/media-qa/<UTC timestamp>/; nonzero exit blocks completion.');
} else if (!args.includes('--locked')) {
  // One lock covers all suites, including scripts that bring their own tab to front.
  const child=spawn('flock',['-w','40',resolve(project,'explorations/2026-11-06/.browser.lock'),process.execPath,self,'--locked'],
    {cwd:project,env:process.env,stdio:'inherit'});
  child.on('error',e=>{console.error(e.message);process.exitCode=1;});
  child.on('exit',code=>{process.exitCode=code??1;});
} else {
  process.chdir(project);
  const timestamp=new Date().toISOString().replace(/[:.]/g,'-');
  const out=resolve(project,'refinements/media-qa',timestamp);
  const target=process.env.LANDING_QA_URL||'http://127.0.0.1:8720/design-lab/refined-opus/landing/site/';
  const url=new URL(target);
  if (!['127.0.0.1','localhost'].includes(url.hostname)||url.search||url.hash||!url.pathname.endsWith('/')) {
    throw Error('This fault-injection gate requires a local candidate directory URL ending in /, without query or hash');
  }
  await mkdir(out+'/shots/live',{recursive:true});
  await mkdir(out+'/shots/publication',{recursive:true});
  await mkdir(out+'/slow',{recursive:true});
  const report={startedAt:new Date().toISOString(),url:target,passed:false,output:relative(project,out),suites:[],
    limits:['Desktop Chrome with mobile viewport/network emulation; not a physical Android/Mac test.',
      'Autoplay denial is simulated. Visibility-handler test is synthetic; real hidden must be observed separately.',
      'Native frame advance does not prove pixel correctness or 60 FPS; inspect saved screenshot pairs.']};
  const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
  async function snapshot() {
    const hashes={};
    async function tree(dir,prefix='') {
      for (const e of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
        const name=prefix+e.name, path=resolve(dir,e.name);
        if (e.isSymbolicLink()) throw Error('Build contains a symlink: '+name);
        if (e.isDirectory()) await tree(path,name+'/');
        else hashes['site/'+name]=digest(await readFile(path));
      }
    }
    await tree(resolve(project,'landing/site'));
    for (const name of ['index.html','soon.html','scenes.js','scenes.css','landing.css','fonts/geologica-cyrillic.woff2','fonts/geologica-latin.woff2','vendor/gsap.min.js']) {
      const source=digest(await readFile(resolve(project,'landing',name)));
      if (hashes['site/'+name]!==source) throw Error('Stale build: '+name+' differs. Run python3 landing/scripts/build-pages.py');
      hashes['source/'+name]=source;
    }
    const publication=JSON.parse(await readFile('landing/publication-manifest.json','utf8'));
    for (const item of publication.files) {
      if (hashes['site/'+item.path]!==item.sha256) throw Error('Publication manifest mismatch: '+item.path);
      const source=digest(await readFile(resolve(project,'landing',item.path)));
      if (source!==item.sha256) throw Error('Source media differs from build/manifest: '+item.path);
    }
    for (const name of ['media-manifest.json','publication-manifest.json']) hashes['source/'+name]=digest(await readFile('landing/'+name));
    return hashes;
  }
  try {
    report.hashes=await snapshot();
    // Prove the server is serving these bytes, not another checkout/stale path.
    for (const name of ['index.html','scenes.js','scenes.css','landing.css','release.json']) {
      const response=await fetch(new URL(name,target),{cache:'no-store',signal:AbortSignal.timeout(10000)});
      if (!response.ok||digest(Buffer.from(await response.arrayBuffer()))!==report.hashes['site/'+name]) {
        throw Error('Served build differs from local artifact: '+name);
      }
    }
    for (const [name,file,json] of [
      ['recovery','check.mjs','recovery-checks.json'],
      ['mobile-drum','mobile-drum.mjs','mobile-drum.json'],
      ['slow-mobile','slow-mobile.mjs','slow/report.json'],
      ['resources','resources.mjs','resources.json'],
      ['behavior','behavior.mjs','behavior.json'],
      ['native-video','rendered-video.mjs','rendered-video.json'],
      ['publication','publication.mjs','publication.json'],
      ['diagnostics','debug-check.mjs','debug-check.json']
    ]) {
      console.log('START '+name);
      const entry={name,passed:false,startedAt:new Date().toISOString()};
      report.suites.push(entry);
      try {
        const result=await promisify(execFile)(process.execPath,[resolve(project,'tools/qa/landing-media/suites',file)],
          {cwd:project,env:{...process.env,LANDING_QA_URL:target,MEDIA_QA_OUT:out},maxBuffer:4e6,timeout:240000});
        await writeFile(out+'/'+name+'.log',result.stdout+result.stderr);
        entry.evidence=verify(name,JSON.parse(await readFile(resolve(out,json),'utf8')));
        entry.passed=true;
        console.log('PASS '+name+' '+JSON.stringify(entry.evidence));
      } catch (error) {
        await writeFile(out+'/'+name+'-failure.log',(error.stdout||'')+(error.stderr||'')+'\n'+String(error));
        entry.error=error.message;
        throw error;
      } finally {
        entry.endedAt=new Date().toISOString();
        await writeFile(out+'/gate.json',JSON.stringify(report,null,2));
      }
    }
    if (JSON.stringify(await snapshot())!==JSON.stringify(report.hashes)) throw Error('Candidate changed during QA; rerun on final bytes');
    report.passed=true;
  } catch (error) {
    report.error=error.message;
    process.exitCode=1;
    console.error('BLOCKED: '+error.message);
  } finally {
    report.endedAt=new Date().toISOString();
    await writeFile(out+'/gate.json',JSON.stringify(report,null,2));
    console.log('REPORT '+relative(project,out)+'/gate.json');
  }
}
