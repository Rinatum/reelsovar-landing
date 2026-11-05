// Use the taste skill's real-browser probes over the required existing shared Chrome.
// The stock inspect launcher starts a separate Chrome, which project instructions prohibit.
import{chromium}from'/usr/lib/node_modules/playwright-core/index.mjs';
import{writeFile}from'node:fs/promises';
import{probe,layout}from'/home/grin/.codex/skills/taste-skill/scripts/lib/probe.mjs';
import{judge,judgeLayout}from'/home/grin/.codex/skills/taste-skill/scripts/lib/rules.mjs';
const b=await chromium.connectOverCDP('http://127.0.0.1:9222'),p=await b.contexts()[0].newPage(),report=[];
try{for(const width of [1440,768,390]){await p.setViewportSize({width,height:width<760?844:1000});await p.goto('http://127.0.0.1:8720/design-lab/refined-opus/landing/');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(2300);const metrics=await p.evaluate(probe),L=await p.evaluate(layout);report.push({width,findings:[...judge(metrics,{width}),...judgeLayout(L,{width})]});}}finally{await writeFile('landing/qa/design-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await p.close();await b.close()}
