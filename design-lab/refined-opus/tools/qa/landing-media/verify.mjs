// Verify evidence, not just a successful child-process exit code.
export function verify(name, report) {
  if (!report || typeof report!=='object') throw Error(name+': report missing');
  if (report.errors?.length) throw Error(name+': unexpected runtime/HTTP errors');
  const minimum = {recovery:13,behavior:17,'native-video':55,publication:12,resources:4};
  if (Object.hasOwn(minimum,name)) {
    const checks=report.checks||report.results;
    if (!Array.isArray(checks)||checks.length<minimum[name]||!checks.every(c=>c.ok===true)) {
      throw Error(name+': incomplete or failed checks');
    }
    return {checks:checks.length};
  }
  if (name==='mobile-drum') {
    if (report.passed!==true||report.ids?.length!==11||report.samples?.length<12||
        !report.samples.slice(2).every(sample=>sample.ok===true)) throw Error('Mobile drum coverage/playback failed');
    return {uniqueClips:report.ids.length,healthyWindows:report.samples.filter(s=>s.ok).length,windows:report.samples.length,
      startupGraceWindows:2};
  }
  if (name==='slow-mobile') {
    const expected=[6,4,4]; // Source + the accepted 5/3/3 results.
    const groups=new Set();
    let movingWindows=0;
    for (const run of report.runs||[]) {
      let start=null;
      for (const sample of run.samples||[]) {
        const valid=sample.phase==='results'&&sample.active&&!sample.hidden&&sample.vis>0&&
          sample.videos.length===expected[sample.group]&&
          sample.videos.every(v=>v.src&&!v.paused&&!v.waiting&&v.ready>=2&&Number.isFinite(v.frames));
        const same=start&&sample.group===start.group&&
          sample.videos.every((v,i)=>v.src===start.videos[i].src&&v.frames>=start.videos[i].frames);
        if (!valid) {start=null;continue;}
        if (!same) {start=sample;continue;}
        if (sample.at-start.at>=650) {
          if (sample.videos.every((v,i)=>v.frames-start.videos[i].frames>=3)) {
            groups.add(sample.group);
            movingWindows++;
          }
          start=sample;
        }
      }
    }
    if ([0,1,2].some(g=>!groups.has(g))) throw Error('Slow network: source + ALL its results did not move together in every group');
    return {groups:[...groups].sort(),movingWindows,minimumWindowMs:650};
  }
  if (name==='diagnostics') {
    if (report.ok!==true||report.probe?.status!==200||!report.version) throw Error('Local diagnostic/server probe failed');
    return {version:report.version,probe:report.probe};
  }
  throw Error('Unknown suite '+name);
}
