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
for y in range(47,60):
 for x in range(60):
  if x<19 or x>40 or y>=57:assert front.getpixel((x,y))[3]==0,(x,y,'foot-side artifact')
mask=front.getchannel('A');inside=mask.filter(ImageFilter.MinFilter(3))
for y in range(43):
 for x in range(60):
  r,g,b,a=front.getpixel((x,y));hair=y<19 or x<16 or x>44
  if a and hair and inside.getpixel((x,y))==0:
   assert not (min(r,g,b)>105 and max(r,g,b)-min(r,g,b)<32),(x,y,'white edge')
left=Image.open(D/'girl-left.png');right=Image.open(D/'girl-right.png')
assert ImageChops.difference(left,right.transpose(Image.Transpose.FLIP_LEFT_RIGHT)).getbbox() is None
svg=rasterize_svg(D/'girl-walk.svg');png=Image.open(R/'public/assets/girl-walk.png').convert('RGBA')
assert ImageChops.difference(svg,png).getbbox() is None
print('PASS: SVG/PNG parity, 16-frame atlas parity, binary alpha, no foot-side matte, no white hair edge, left/right mirror.')
