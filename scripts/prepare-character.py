"""Build pixel-grid SVG masters and a four-direction sprite sheet from girl_idle.png.

The front preserves original pixels (except its white matte/ground oval).
The profile uses original hair and garment pixels inside a newly drawn 90-degree
silhouette; skin/eye/outline colors are sampled directly from the original.
No generated reference image is used. The source icon remains unmodified.
"""
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path
from collections import Counter
import json

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'public/assets/character'
DEST.mkdir(parents=True,exist_ok=True)
src=Image.open(ROOT/'girl_idle.png').convert('RGBA')

def rgba(c):return tuple(c)+(255,) if len(c)==3 else tuple(c)
def sample(x,y):return src.getpixel((x,y))[:3]
# A deliberately small outline/accent palette sampled from the supplied artwork.
colors={
 'outline':sample(14,8),'hairDark':sample(12,16),'hairMid':sample(17,12),
 'hairLight':sample(23,9),'hairShade':sample(8,27),
 'skin':sample(28,26),'skinLight':sample(30,25),'skinShade':sample(24,27),
 'eye':sample(21,21),'eyeDark':sample(20,21),
 'cloth':sample(29,37),'clothLight':sample(26,35),'clothShade':sample(21,40),
 'boot':sample(26,53),'bootLight':sample(25,51)
}
# Use actual low-luminance hair samples for contour, avoiding the source matte.
colors['outline']=sample(9,14)
colors['hairDark']=sample(14,19)

def poly(im,points,color):ImageDraw.Draw(im).polygon(points,fill=rgba(color))
def rect(im,box,color):ImageDraw.Draw(im).rectangle(box,fill=rgba(color))
def line(im,points,color,width=1):ImageDraw.Draw(im).line(points,fill=rgba(color),width=width)

def clean_source():
 im=src.copy()
 # Separate the feet from the original baked oval. The old y>=51 rule missed
 # gray matte pixels beside the stockings at y=47..50.
 for y in range(60):
  for x in range(60):
   r,g,b,a=im.getpixel((x,y))
   outside_feet=(y>=47 and (x<19 or x>40)) or (y==56 and (x<20 or x>39)) or y>=57
   if a<160 or outside_feet:im.putpixel((x,y),(0,0,0,0))
   else:im.putpixel((x,y),(r,g,b,255))
 # Remove desaturated white matte at the silhouette, rather than painting the
 # white pixels dark and leaving disconnected fragments attached to the hair.
 for _ in range(3):
  mask=im.getchannel('A');inside=mask.filter(ImageFilter.MinFilter(3))
  changes=[]
  for y in range(57):
   for x in range(60):
    r,g,b,a=im.getpixel((x,y))
    if not a:continue
    pale=min(r,g,b)>105 and max(r,g,b)-min(r,g,b)<32
    if pale and inside.getpixel((x,y))==0:
     changes.append((x,y))
  for point in changes:im.putpixel(point,(0,0,0,0))
 # Any remaining pale pixels in the HAIR use original brown, never white.
 for y in range(47):
  for x in range(60):
   r,g,b,a=im.getpixel((x,y))
   hair=(y<19 or (x<16 or x>44) and y<43)
   if a and hair and min(r,g,b)>110 and max(r,g,b)-min(r,g,b)<45:
    im.putpixel((x,y),rgba(colors['hairMid']))
 # Gray edge pixels darker than the first matte threshold can still read white
 # on a black dialogue panel. Replace those HAIR-EDGE colors with source brown.
 mask=im.getchannel('A');inside=mask.filter(ImageFilter.MinFilter(3))
 for y in range(45):
  for x in range(60):
   r,g,b,a=im.getpixel((x,y))
   hair=(y<19 or (x<16 or x>44) and y<43)
   if a and hair and inside.getpixel((x,y))==0 and max(r,g,b)-min(r,g,b)<40:
    im.putpixel((x,y),rgba(colors['hairShade']))
 # Strip isolated matte islands; protect all genuine connected body details.
 mask=im.getchannel('A')
 for y in range(1,57):
  for x in range(1,59):
   if mask.getpixel((x,y)) and not any(mask.getpixel(q) for q in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]):
    im.putpixel((x,y),(0,0,0,0))
 return im

front=clean_source()

hair_source=front.filter(ImageFilter.MedianFilter(3))
def original_hair(x,y,zone='crown'):
 """Source shading, without the old repeated texture columns/eye contamination."""
 if zone=='crown' and y<18:
  sx=max(8,min(49,round(8+(x-13)*1.1)));sy=max(3,y)
 else:
  sx=max(7,min(15,round(7+(x-11)*.32)));sy=max(10,min(42,y))
 r,g,b,a=hair_source.getpixel((sx,sy))
 if a==0 or r-g>40 or (min(r,g,b)>110 and max(r,g,b)-min(r,g,b)<40):
  return colors['hairMid']
 return (r,g,b)

def fill_hair(im,points,zone='crown'):
 mask=Image.new('L',(60,60));ImageDraw.Draw(mask).polygon(points,fill=255)
 inside=mask.filter(ImageFilter.MinFilter(3))
 for y in range(60):
  for x in range(60):
   if mask.getpixel((x,y)):
    im.putpixel((x,y),rgba(original_hair(x,y,zone) if inside.getpixel((x,y)) else colors['outline']))
 return mask

# The profile uses the SAME visible locks as the front, with source y preserved.
# Thus the forehead, cheek-level bend and hem-level tips stay at the same height.
PROFILE_HAIR = {
 'crown': [(25,1),(34,1),(34,2),(40,2),(40,4),(44,4),(44,6),
           (47,6),(47,10),(49,10),(49,17),(47,20),(43,22),
           (37,25),(27,26),(20,25),(16,23),(13,20),(13,13),
           (16,8),(20,4),(25,4)],
 'rear': [(21,12),(29,12),(32,18),(32,25),(30,31),(30,36),
          (31,39),(29,42),(26,43),(23,42),(20,43),(17,41),
          (15,38),(14,33),(14,27),(13,22),(15,16)],
 'fringe': [(29,7),(40,7),(45,11),(47,14),(47,18),(45,20),
            (42,20),(40,19),(39,21),(37,22),(36,24),(33,23),(31,19)],
 'near': [(29,14),(33,14),(35,18),(35,24),(34,28),(35,32),
          (37,35),(37,38),(35,41),(33,43),(30,42),(29,40),
          (30,37),(30,34),(28,30),(27,25),(27,20)]
}

def profile_hair(im,part):
 """One hairstyle at three angles, not a stretched strip of cropped hair.

Lengths and the cheek-level curve come from the front/back landmarks. The crown
retains source pixels. Hanging hair uses broad lengthwise planes in colors taken
from the same source; no repeated horizontal rows or additional strand lines.
 """
 points=PROFILE_HAIR[part]
 mask=Image.new('L',(60,60));ImageDraw.Draw(mask).polygon(points,fill=255)
 inner=mask.filter(ImageFilter.MinFilter(3))
 # All of these exact colors occur in the cleaned source hair (not a new palette).
 shade=(82,54,61);base=(104,76,83);mid=(111,81,85)
 light=(120,90,94);edge=(88,60,65)
 layer=Image.new('RGBA',(60,60),rgba(base))
 if part=='rear':
  poly(layer,[(13,16),(19,13),(18,22),(16,30),(17,37),(20,42),
              (17,44),(13,40)],shade)
  poly(layer,[(20,13),(25,13),(26,20),(24,28),(24,34),(27,39),
              (25,42),(21,41),(20,35),(21,28),(19,21)],mid)
  poly(layer,[(20,16),(22,15),(23,21),(22,29),(23,35),(24,38),
              (22,40),(20,36),(20,30),(21,23)],light)
  poly(layer,[(28,16),(32,18),(31,28),(29,33),(30,38),(28,42),
              (26,40),(27,35),(26,29)],shade)
 elif part=='near':
  poly(layer,[(27,14),(30,14),(29,23),(30,30),(32,34),(31,39),
              (32,43),(29,43),(28,38),(29,34),(26,28)],shade)
  poly(layer,[(31,16),(33,18),(32,24),(32,30),(35,35),(35,38),
              (33,41),(31,40),(33,37),(32,34),(30,28),(30,22)],light)
  poly(layer,[(35,18),(36,23),(35,29),(37,34),(38,38),(35,42),
              (33,43),(34,40),(35,37),(34,32)],edge)
 else:
  # Preserve the source crown/fringe shading at the same y, without stretching
  # source eye/matte pixels into the lower head. Lower cap merges into the locks.
  for y in range(2,26):
   for x in range(13,50):
    if y<18:
     sx=round(8+(x-13)*1.12) if part=='crown' else round(25+(x-29)*1.05)
     sx=max(5,min(50,sx));r,g,b,a=front.getpixel((sx,y))
     rgb=(r,g,b) if a and 0<r-g<43 and min(r,g,b)<121 else base
     # Ease the original scalp texture into the hanging mass, avoiding a cap seam.
     if y>12:
      k=(y-12)/9
      rgb=tuple(round(v*(1-k)+q*k) for v,q in zip(rgb,mid if 18<x<27 else base))
    else:
     rgb=mid if 18<x<27 else base
     if x<17 or x>43:rgb=edge
    layer.putpixel((x,y),rgba(rgb))
 # Subtle source texture stays within each longitudinal shading plane. It cannot
 # create stripes: only local, high-frequency source variation is transferred.
 if part in ('rear','near'):
  source_x=9 if part=='rear' else 46
  for y in range(14,44):
   for x in range(13,38):
    c=front.getpixel((source_x+(x%3),y));smooth=hair_source.getpixel((source_x+(x%3),y));d=max(-4,min(4,(c[0]-smooth[0])//3)) if c[3] else 0
    r,g,b,a=layer.getpixel((x,y));layer.putpixel((x,y),(r+d,g+d,b+d,a))
 for y in range(60):
  for x in range(60):
   if not mask.getpixel((x,y)):continue
   rgb=layer.getpixel((x,y))[:3]
   # Blend only the outside contour. The scalp/lock overlap has no dark seam.
   if not inner.getpixel((x,y)) and part in ('rear','near'):
    rgb=tuple(round(v*.75+e*.25) for v,e in zip(rgb,edge))
   im.putpixel((x,y),rgba(rgb))
 return mask

def make_profile():
 im=Image.new('RGBA',(60,60))
 # Keep the original doll-like proportions: broad rounded head, very short
 # neck, tiny torso and small boots. All visible details point to the right.
 profile_hair(im,'rear')
 # Far stocking and compact forward-pointing shoe (partly behind near leg).
 poly(im,[(32,44),(37,44),(37,52),(39,53),(40,55),(32,55),(31,53)],sample(25,54))
 rect(im,(33,45,36,49),sample(25,47));rect(im,(33,49,36,50),sample(25,50))
 # Preserve the original dress pixels and soft pink-gray shading.
 dressmask=Image.new('L',(60,60))
 ImageDraw.Draw(dressmask).polygon([(33,31),(38,31),(40,33),(41,38),
  (43,42),(45,44),(43,46),(29,46),(27,44),(29,39),(30,34)],fill=255)
 edge=dressmask.filter(ImageFilter.MinFilter(3))
 for y in range(31,47):
  for x in range(27,46):
   if dressmask.getpixel((x,y)):
    sx=min(42,19+round((x-27)*1.1));rgba_source=front.getpixel((sx,min(44,y)))
    if not rgba_source[3]:rgba_source=rgba(colors['clothShade'])
    im.putpixel((x,y),rgba_source if edge.getpixel((x,y)) else rgba(sample(22,44)))
 # Narrow collar/tie seen edge-on, not a broad frontal chest.
 poly(im,[(36,30),(39,30),(41,33),(39,34),(36,32)],colors['clothLight'])
 rect(im,(40,33,40,36),sample(30,33))
 # Near leg. A one-pixel toe extension keeps the small original boot shape.
 poly(im,[(35,46),(40,46),(40,52),(42,53),(43,54),(43,56),(35,56),(34,53)],sample(25,54))
 rect(im,(36,46,39,50),sample(34,48));rect(im,(37,49,39,51),sample(36,49))
 rect(im,(36,53,39,54),sample(26,53));rect(im,(40,54,41,54),sample(26,53))
 # Small relaxed sleeve and hand; less angular than the previous elbow block.
 poly(im,[(32,33),(35,33),(37,35),(37,38),(35,40),(31,39),(30,37)],sample(22,38))
 poly(im,[(32,34),(35,34),(36,36),(35,38),(31,38),(31,36)],colors['clothLight'])
 rect(im,(32,39,35,40),sample(23,38));rect(im,(33,41,35,42),sample(28,26))
 # Broad rounded crown, with source hair pixels rather than synthetic detail.
 profile_hair(im,'crown')
 # A round cheek, shallow one-pixel nose and NO hard mouth/chin line.
 # The old long stepped nose + dark jaw accidentally read as an adult grin.
 cheek=sample(30,25);edge_skin=sample(26,27);shadow_skin=sample(23,26)
 poly(im,[(39,18),(44,18),(46,20),(46,23),(47,24),(47,26),
          (46,27),(46,28),(44,30),(39,30),(36,29),(34,27),(34,23)],edge_skin)
 poly(im,[(39,19),(44,19),(45,21),(45,24),(46,24),(46,27),
          (44,29),(39,29),(36,28),(35,26),(35,23)],cheek)
 rect(im,(39,26,44,28),sample(31,26))
 rect(im,(45,25,46,26),sample(30,25))
 # The thick fringe and long cheek-side lock correspond to the front/back.
 # The near lock reaches the hem at y=43, not the old shoulder-length y=33.
 profile_hair(im,'fringe')
 profile_hair(im,'near')
 # Copy ONE original eye at its original pixel size. Do not invent a large,
 # sharp eyebrow, white anime highlight, smile, or a second profile eye.
 for yy in range(6):
  for xx in range(4):
   c=src.getpixel((19+xx,19+yy))
   if max(c[:3])<145:im.putpixel((41+xx,20+yy),(c[0],c[1],c[2],255))
 # Source lower-eye shade and subtle cheek tint; there is deliberately no mouth.
 rect(im,(42,25,43,25),sample(23,24))
 rect(im,(39,26,40,26),sample(24,25))
 return im

right=make_profile()
left=right.transpose(Image.Transpose.FLIP_LEFT_RIGHT)

def make_back():
 im=front.copy()
 # The rear view is explicitly drawn, not a rectangular patch over the face.
 fill_hair(im,[(16,5),(24,2),(36,2),(44,5),(50,11),(53,20),(51,28),
               (49,34),(46,41),(40,44),(34,42),(29,43),(23,42),(18,43),
               (12,39),(9,29),(7,21),(9,12)],'crown')
 # Transfer the original long side locks to the lower back with a hair-only mask.
 fill_hair(im,[(14,18),(46,18),(47,27),(44,37),(40,42),(34,41),(30,43),
               (24,41),(20,43),(15,38),(12,29)],'length')
 for points in [[(20,10),(17,18),(18,27),(17,34)],[(29,7),(26,18),(27,29),(25,38)],[(38,9),(39,19),(38,29),(36,38)]]:
  line(im,points,colors['hairMid'])
 return im
back=make_back()

def svg_for(im,name,display_scale=1):
 """Lossless SVG, on the original 60x60 pixel grid. Horizontal pixel runs only."""
 lines=['<?xml version="1.0" encoding="UTF-8"?>',
  f'<svg xmlns="http://www.w3.org/2000/svg" width="{im.width*display_scale}" height="{im.height*display_scale}" viewBox="0 0 {im.width} {im.height}" shape-rendering="crispEdges">',
  f'<title>{name}</title>',
  '<desc>Derived from the supplied girl_idle.png. Original pixel samples with matte removed; side silhouette, profile face and pose reconstructed on a 60x60 grid. Unseen details are an adaptation, not assertions about the original design.</desc>']
 for y in range(im.height):
  x=0
  while x<im.width:
   c=im.getpixel((x,y));end=x+1
   while end<im.width and im.getpixel((end,y))==c:end+=1
   if c[3]:lines.append(f'<rect x="{x}" y="{y}" width="{end-x}" height="1" fill="#{c[0]:02x}{c[1]:02x}{c[2]:02x}"/>')
   x=end
 lines.append('</svg>');return '\n'.join(lines)+'\n'

def side_frame(base,frame):
 if frame==0:return base.copy()
 # Distinct legs swing in opposite directions with separated forward-pointing toes.
 stride=[0,3,0,-3][frame];bob=1 if frame in (1,3) else 0
 im=Image.new('RGBA',(60,60));im.alpha_composite(base.crop((0,0,60,46)),(0,bob))
 # Preserve hanging hair independently from the walking legs.
 im.alpha_composite(base.crop((0,46,29,52)),(0,46+bob))
 leg_far=base.crop((29,46,36,56));leg_near=base.crop((36,46,46,57))
 im.alpha_composite(leg_far,(29-stride,46+(1 if stride>0 else 0)))
 im.alpha_composite(leg_near,(36+stride,46-(1 if stride<0 else 0)))
 return im

def front_frame(base,frame):
 if frame==0:return base.copy()
 stride=[0,1,0,-1][frame];im=Image.new('RGBA',(60,60))
 im.alpha_composite(base.crop((0,0,60,45)),(0,abs(stride)))
 im.alpha_composite(base.crop((0,45,19,51)),(0,45))
 im.alpha_composite(base.crop((43,45,60,51)),(43,45))
 im.alpha_composite(base.crop((19,45,30,57)),(19,45+stride))
 im.alpha_composite(base.crop((30,45,43,57)),(30,45-stride))
 return im
sheet=Image.new('RGBA',(240,240))
for row,(name,base) in enumerate([('front',front),('left',left),('right',right),('back',back)]):
 (DEST/f'girl-{name}.svg').write_text(svg_for(base,f'主人公・{name}',8),encoding='utf8')
 base.save(DEST/f'girl-{name}.png')
 for frame in range(4):
  if row in (1,2):
   im=side_frame(right,frame)
   if row==1:im=im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
  else:im=front_frame(base,frame)
  sheet.alpha_composite(im,(frame*60,row*60))
  (DEST/f'girl-{name}-walk-{frame}.svg').write_text(svg_for(im,f'主人公・{name} 歩行 {frame}'),encoding='utf8')
(DEST/'girl-walk.svg').write_text(svg_for(sheet,'主人公・四方向の歩行シート'),encoding='utf8')
sheet.save(ROOT/'public/assets/girl-walk.png');front.save(ROOT/'public/assets/girl.png')
(DEST/'source-palette.json').write_text(json.dumps(colors,indent=2))
print('Generated clean front + true profile SVGs, back SVG, and 16-frame PNG atlas.')
