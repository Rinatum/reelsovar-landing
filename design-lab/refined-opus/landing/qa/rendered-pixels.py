from pathlib import Path
from PIL import Image, ImageChops, ImageStat
import json,sys
report=json.loads(Path(sys.argv[1] if len(sys.argv)>1 else 'landing/qa/rendered-video.json').read_text())
rows=[]
for group in report['samples']:
 a=Image.open('landing/shots/live/'+group['name']+'-a.png').convert('RGB')
 b=Image.open('landing/shots/live/'+group['name']+'-b.png').convert('RGB')
 for v in group['before']:
  r=v['rect'];cx=r['x']+r['w']/2;top=r['y']+r['h']*.18;bottom=r['y']+r['h']*.92
  box=(max(0,round(cx-10)),max(0,round(top)),min(a.width,round(cx+10)),min(a.height,round(bottom)))
  if group['name'].startswith(('wide-input','original-')): box=(max(0,round(r['x']+r['w']*.05)),max(0,round(r['y']+r['h']*.05)),min(a.width,round(r['x']+r['w']*.95)),min(a.height,round(r['y']+r['h']*.95)))
  delta=sum(ImageStat.Stat(ImageChops.difference(a.crop(box),b.crop(box))).mean)/3
  luma=sum(ImageStat.Stat(a.crop(box)).mean)/3
  rows.append({'sample':group['name'],'src':v['src'],'pixel_delta':delta,'moving':delta>.12,'luma':round(luma,1),'black':luma<14,'crop':box})
Path(sys.argv[2] if len(sys.argv)>2 else 'landing/qa/rendered-pixels.json').write_text(json.dumps(rows,indent=2))
print(json.dumps({'visible_video_regions':len(rows),'moving':sum(r['moving'] for r in rows),'frozen':[r for r in rows if not r['moving']],'black':[r for r in rows if r['black']],'min_luma':min(r['luma'] for r in rows)},indent=2))
assert all(r['moving'] for r in rows),'A rendered video region stayed frozen'
assert not any(r['black'] for r in rows),'A rendered video region is black'
