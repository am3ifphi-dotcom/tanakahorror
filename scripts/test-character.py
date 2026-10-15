"""Pixel-level regressions for the white matte and actual SVG contents."""
from pathlib import Path
from PIL import Image,ImageChops,ImageFilter
import xml.etree.ElementTree as ET
R=Path(__file__).resolve().parents[1]
D=R/'public/assets/character'

def rasterize_svg(path):
 root=ET.parse(path).getroot();_,_,w,h=map(int,root.attrib['viewBox'].split())
 im=Image.new('RGBA',(w,h))
 for el in root:
  if not el.tag.endswith('rect'):continue
  x,y,w,h=(int(el.attrib[k]) for k in ['x','y','width','height'])
  color=el.attrib['fill'];rgb=tuple(int(color[i:i+2],16) for i in [1,3,5])+(255,)
  for yy in range(y,y+h):
   for xx in range(x,x+w):im.putpixel((xx,yy),rgb)
 return im
for side in ['front','left','right','back']:
 svg=rasterize_svg(D/f'girl-{side}.svg');png=Image.open(D/f'girl-{side}.png').convert('RGBA')
 assert ImageChops.difference(svg,png).getbbox() is None, side+' SVG/PNG mismatch'
 assert set(png.getchannel('A').tobytes())<={0,255},'Partial alpha/matte'
front=Image.open(D/'girl-front.png').convert('RGBA')
# The front/back masters sit one row lower on the sheet (FRONT_DROP, mirroring
# SIDE_DROP) so the walk can raise the body without clipping the fringe; the
# leg band therefore starts on row 48 and the feet end on row 57.
for y in range(48,60):
 for x in range(60):
  if x<19 or x>40 or y>=58:assert front.getpixel((x,y))[3]==0,(x,y,'foot-side artifact')
mask=front.getchannel('A');inside=mask.filter(ImageFilter.MinFilter(3))
for y in range(43):
 for x in range(60):
  r,g,b,a=front.getpixel((x,y));hair=y<19 or x<16 or x>44
  if a and hair and inside.getpixel((x,y))==0:
   assert not (min(r,g,b)>105 and max(r,g,b)-min(r,g,b)<32),(x,y,'white edge')

# Front and back: the background must show between the legs. The supplied
# drawing kept its white studio background there (the slit is enclosed by the
# hem, a leg on each side and the touching shoes), which read as webbed legs.
def interior_gaps(im,y):
 """Transparent runs that have opaque pixels on both sides of the same row."""
 xs=[x for x in range(im.width) if im.getpixel((x,y))[3]]
 if not xs:return []
 runs=[];x=xs[0]
 while x<xs[-1]:
  if im.getpixel((x,y))[3]==0:
   end=x
   while im.getpixel((end,y))[3]==0:end+=1
   runs.append((x,end-1));x=end
  else:x+=1
 return runs
for label in ['front','back']+[f'{v}-walk-{f}' for v in ['front','back'] for f in (1,2,3)]:
 im=Image.open(D/f'girl-{label}.png').convert('RGBA')
 slit={y:[(a,b) for a,b in interior_gaps(im,y) if 24<=a and b<=36] for y in range(45,59)}
 rows=[y for y,runs in slit.items() if runs]
 assert len(rows)>=5,(label,'legs fused: no background between them',rows)
 assert max(rows)-min(rows)+1==len(rows),(label,'slit between the legs is broken',rows)
 for y in rows:
  assert len(slit[y])==1,(label,y,'more than one hole between the legs',slit[y])
  (a,b),=slit[y]
  assert b-a+1<=4,(label,y,'slit wider than the gap between the legs',(a,b))
  for x in (a-1,b+1):
   r,g,bl,_=im.getpixel((x,y));lum=(r*299+g*587+bl*114)//1000
   assert not (max(r,g,bl)-min(r,g,bl)<20 and lum>=128),(label,x,y,'white matte left beside the slit')

# Side views come from the supplied girl_left.png / girl_right.png, so they are
# distinct drawings (not mirrors). What must hold: no whitish/grey background
# pixel (matte, floor oval, curl windows), no one-pixel wisps, one solid figure.
def whitish(p):
 r,g,b,a=p;lum=(r*299+g*587+b*114)//1000;sat=max(r,g,b)-min(r,g,b)
 return a and ((sat<16 and lum>=128) or (sat<20 and lum>=176))
def opaque(im,x,y):return 0<=x<im.width and 0<=y<im.height and im.getpixel((x,y))[3]>0
def check_side(im,label):
 for y in range(im.height):
  for x in range(im.width):
   p=im.getpixel((x,y))
   assert not whitish(p),(label,x,y,p,'whitish matte pixel')
   if p[3]:
    n=sum(opaque(im,x+dx,y+dy) for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)])
    assert n>=2,(label,x,y,'one-pixel wisp')
 seen=set();comps=0
 for y in range(im.height):
  for x in range(im.width):
   if opaque(im,x,y) and (x,y) not in seen:
    comps+=1;stack=[(x,y)];seen.add((x,y))
    while stack:
     cx,cy=stack.pop()
     for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
      q=(cx+dx,cy+dy)
      if opaque(im,*q) and q not in seen:seen.add(q);stack.append(q)
 assert comps==1,(label,'disconnected fragments',comps)
left=Image.open(D/'girl-left.png').convert('RGBA');right=Image.open(D/'girl-right.png').convert('RGBA')
check_side(left,'left');check_side(right,'right')
assert ImageChops.difference(left,right).getbbox() is not None,'left/right must be the two supplied drawings'
for im,src in [(left,'girl_left.png'),(right,'girl_right.png')]:
 # Every kept pixel comes from the supplied drawing (same place, one row lower).
 source=Image.open(R/'source'/src).convert('RGBA')
 kept=sum(1 for y in range(1,60) for x in range(60) if im.getpixel((x,y))[3])
 from_source=sum(1 for y in range(1,60) for x in range(60) if im.getpixel((x,y))[3] and source.getpixel((x,y-1))[3])
 assert kept>2000 and from_source>=kept-40,(src,kept,from_source,'side view drifted from the supplied pixels')
# The sheet the game reads is the only place a frame is stored twice: cell
# (row,0) must be the standing drawing, cells 1..3 the three walk files. No
# other copy of any frame exists, so every stored image has to be distinct.
sheet=rasterize_svg(D/'girl-walk.svg')
assert sheet.size==(240,240),'the walk sheet must stay 4 directions x 4 frames'
stored={}
for row,name in enumerate(['front','left','right','back']):
 base=Image.open(D/f'girl-{name}.png').convert('RGBA')
 stored[f'girl-{name}.png']=base
 frames=[sheet.crop((f*60,row*60,f*60+60,row*60+60)) for f in range(4)]
 assert ImageChops.difference(frames[0],base).getbbox() is None,(name,'frame 0 must be the standing drawing')
 assert not (D/f'girl-{name}-walk-0.png').exists(),(name,'frame 0 is the standing file, not a copy')
 for f in (1,2,3):
  png=Image.open(D/f'girl-{name}-walk-{f}.png').convert('RGBA');stored[f'girl-{name}-walk-{f}.png']=png
  assert ImageChops.difference(rasterize_svg(D/f'girl-{name}-walk-{f}.svg'),png).getbbox() is None,(name,f,'SVG/PNG mismatch')
  assert ImageChops.difference(frames[f],png).getbbox() is None,(name,f,'sheet cell differs from the frame file')
 assert len({fr.tobytes() for fr in frames})==4,(name,'all four walk frames must differ')
 ground=base.getchannel('A').getbbox()[3]
 for f,frame in enumerate(frames):
  if name in ('left','right'):check_side(frame,f'{name} frame{f}')
  assert 0<=ground-frame.getchannel('A').getbbox()[3]<=1,('feet left the ground line',name,f)  # a swinging foot may lift one pixel
seen={}
for fname,im in stored.items():seen.setdefault(im.tobytes(),[]).append(fname)
assert all(len(v)==1 for v in seen.values()),('duplicate image files',[v for v in seen.values() if len(v)>1])
for gone in [R/'girl_idle.png',R/'girl_back.png',R/'girl_left.png',R/'girl_right.png',
             R/'public/assets/girl.png',R/'public/assets/girl-walk.png']:
 assert not gone.exists(),(str(gone),'duplicate copy of a frame came back')
print('PASS: SVG/PNG parity, 16-frame atlas parity, binary alpha, no foot-side matte, no white hair edge, side views clean (no matte/oval/wisps), walk frames anchored, no duplicate frames.')
