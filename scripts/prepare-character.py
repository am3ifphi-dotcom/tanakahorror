"""Build pixel-grid SVG masters and a four-direction sprite sheet.

Sources (all 60x60, kept untouched in source/):
- girl_idle.png  -> front view (original pixels; only the white matte, the
                    baked floor oval and the white background trapped between
                    the legs are removed) and the derived back view.
- girl_left.png  -> left view.   Supplied artwork, cleaned on its own grid.
- girl_right.png -> right view.  Supplied artwork, cleaned on its own grid.

The side views are not redrawn: every remaining pixel is either an original
pixel or an original pixel with the white background un-blended from it.
Cleaning removes (1) the floor shadow oval, (2) the pale anti-aliased fringe
left by keying a white background, (3) the white windows inside hair curls and
(4) one-pixel wisps/jaggies, then paints a handful of explicitly listed pixels
so the back-of-head curls become solid instead of broken rings.

Update 9: the front view now carries the torch like the side views do. Dead-on
that carry is foreshortened to two hands meeting in front of the chest with
the lamp seen end-on, so a rim and its lit lens are painted over the dress -
the lens in the exact colour of the game's glow dot. The back view stays as
the clean silhouette. The front/back walk raises the body one pixel on the
passing frames, exactly as the side views always did, instead of dipping it.
"""
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path
from collections import Counter, deque
import json
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'public/assets/character'
DEST.mkdir(parents=True,exist_ok=True)
src=Image.open(ROOT/'source'/'girl_idle.png').convert('RGBA')

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

LEG_ROW=47  # the dress hem ends on row 46, so the legs start here
def clear_leg_gap(im,top=LEG_ROW):
 """Open the slit between the legs.

 Keying the white studio background only reaches the silhouette. The slit
 between the legs is enclosed - hem above, a leg on either side, the shoes
 touching below - so its pale pixels survived and the legs looked webbed
 together by a white block. Flood the slit from the first leg row using the
 same "pale and desaturated" test as the matte pass, so only background
 pixels are dropped and the white socks beside it are untouched.
 """
 def pale(x,y):
  r,g,b,a=im.getpixel((x,y));return a and min(r,g,b)>100 and max(r,g,b)-min(r,g,b)<32
 def dark(x,y):
  r,g,b,a=im.getpixel((x,y));return a and (r*299+g*587+b*114)//1000<80
 # Seeds: pale pixels on the first leg row that have a leg outline on each side.
 seeds=[(x,top) for x in range(60) if pale(x,top)
        and any(dark(i,top) for i in range(x)) and any(dark(i,top) for i in range(x+1,60))]
 gap=set(seeds);queue=deque(seeds)
 while queue:
  x,y=queue.popleft()
  for q in [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]:
   if 0<=q[0]<60 and top<=q[1]<60 and q not in gap and pale(*q):gap.add(q);queue.append(q)
 width=max(x for x,_ in gap)-min(x for x,_ in gap)+1
 assert 0<len(gap)<40 and width<=4,('leg-gap flood escaped into the legs',len(gap),width)
 for point in gap:im.putpixel(point,(0,0,0,0))
 return sorted(gap)

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
 clear_leg_gap(im)
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

# ---------------------------------------------------------------------------
# Side views: de-matting of the supplied girl_left.png / girl_right.png.
# ---------------------------------------------------------------------------
WHITE=np.array([255.,255.,255.])
# The floor shadow baked into both side images (mean of its interior pixels).
FLOOR_OVAL=np.array([176.,176.,176.])
N4=[(0,-1),(-1,0),(1,0),(0,1)]
def lum(rgb):return (rgb[...,0]*299+rgb[...,1]*587+rgb[...,2]*114)//1000
def sat(rgb):return rgb.max(-1)-rgb.min(-1)
def inb(x,y):return 0<=x<60 and 0<=y<60
def box(x0,y0,x1,y1):return [(x,y) for y in range(y0,y1+1) for x in range(x0,x1+1)]

def flood_from_border(passable):
 seen=np.zeros_like(passable,bool);q=deque()
 for y in range(60):
  for x in range(60):
   if (y in (0,59) or x in (0,59)) and passable[y,x]:seen[y,x]=True;q.append((x,y))
 while q:
  x,y=q.popleft()
  for dx,dy in N4:
   nx,ny=x+dx,y+dy
   if inb(nx,ny) and passable[ny,nx] and not seen[ny,nx]:seen[ny,nx]=True;q.append((nx,ny))
 return seen

def components(mask):
 seen=np.zeros_like(mask,bool);out=[]
 for y in range(60):
  for x in range(60):
   if mask[y,x] and not seen[y,x]:
    comp=[(x,y)];seen[y,x]=True;q=deque(comp)
    while q:
     cx,cy=q.popleft()
     for dx,dy in N4:
      nx,ny=cx+dx,cy+dy
      if inb(nx,ny) and mask[ny,nx] and not seen[ny,nx]:seen[ny,nx]=True;q.append((nx,ny));comp.append((nx,ny))
    out.append(comp)
 return out

def local_mean(arr,mask,x,y,r=2):
 ys=slice(max(0,y-r),y+r+1);xs=slice(max(0,x-r),x+r+1);m=mask[ys,xs]
 return arr[ys,xs][m].mean(0) if m.any() else None

class SideView:
 """Removes everything that is background from a keyed side-view icon.

 Terminology: a pixel is *neutral-light* when it is nearly grey and bright;
 those are only ever white background, the grey floor oval, or blends of the
 two with the figure. A pixel is *confident* when it is clearly coloured or
 clearly dark, i.e. certainly part of the figure. Decisions near the outline
 use the estimated coverage of a pixel: P = a*C + (1-a)*W, where C is the
 local figure colour and W the background behind that pixel.
 """
 def __init__(self,path,log=None):
  self.log=log or (lambda *a:None);self.name=Path(path).name
  data=np.array(Image.open(path).convert('RGBA')).astype(float)
  self.rgb=data[...,:3];self.alpha=data[...,3]>0;self.out=self.rgb.copy()
  L=lum(self.rgb);S=sat(self.rgb)
  self.neutral_light=self.alpha&(((S<16)&(L>=128))|((S<20)&(L>=176)))
  self.confident=self.alpha&((S>=16)|(L<64))&~self.neutral_light
  self.matte=np.zeros_like(self.alpha)
 def background(self,x,y):return FLOOR_OVAL if y>=50 else WHITE
 def coverage(self,x,y,C):
  W=self.background(x,y);P=self.out[y,x];d=W-C;d[np.abs(d)<1]=1
  return float(((W-P)/d).clip(0,1).mean())
 def unblend(self,x,y,C,a):
  W=self.background(x,y);est=(self.out[y,x]-(1-a)*W)/max(a,1e-6)
  self.out[y,x]=(0.5*est+0.5*C).clip(0,255);self.confident[y,x]=True
 def remove_background(self):
  """Floor oval, outer fringe and curl windows that touch the outside."""
  reached=flood_from_border((~self.alpha)|self.neutral_light)
  self.matte=reached&self.alpha;self.alpha&=~self.matte
  # Windows fully enclosed by hair are gaps between locks that collapsed at
  # this resolution: paint them with the surrounding hair colour.
  for comp in components(self.neutral_light&~reached&self.alpha):
   for x,y in comp:
    C=local_mean(self.out,self.confident,x,y,2)
    if C is not None:self.out[y,x]=C;self.confident[y,x]=True
   self.log(self.name,'curl window painted',comp)
 def refine_outline(self,keep=0.5):
  """Peel blended outline pixels from the outside in.

  A pixel that is mostly background (coverage below 0.5) is removed; a pixel
  that is mostly figure keeps its place and gets the background un-blended
  from its colour, so no grey halo remains on a dark game background.
  """
  for _ in range(10):
   edge=[(x,y) for y in range(60) for x in range(60) if self.alpha[y,x] and not self.confident[y,x]
         and (x in (0,59) or y in (0,59) or any(not self.alpha[y+dy,x+dx] for dx,dy in N4 if inb(x+dx,y+dy)))]
   removed=0
   for x,y in edge:
    C=local_mean(self.out,self.confident,x,y,2)
    if C is None:C=local_mean(self.out,self.alpha,x,y,2)
    a=self.coverage(x,y,C)
    if a<keep:self.alpha[y,x]=False;self.matte[y,x]=True;removed+=1
    else:self.unblend(x,y,C,a)
   if not removed:break
 def refine_interior(self,contrast=35):
  """Light grey pixels left inside the figure next to former windows."""
  L=lum(self.out);S=sat(self.out);fixed=[]
  for y in range(60):
   for x in range(60):
    if not self.alpha[y,x] or self.confident[y,x] or S[y,x]>=16 or L[y,x]<80:continue
    C=local_mean(self.out,self.confident&self.alpha,x,y,2)
    if C is not None and L[y,x]-lum(C[None])[0]>contrast:
     self.unblend(x,y,C,max(.35,self.coverage(x,y,C)));fixed.append((x,y))
  if fixed:self.log(self.name,'interior grey un-blended',fixed)
 def paint(self,points,sample_box=None):
  """Paint points with the mean of nearby confident pixels (or of a box)."""
  for x,y in points:
   if sample_box:
    x0,y0,x1,y1=sample_box;m=np.zeros((60,60),bool);m[y0:y1+1,x0:x1+1]=True;m&=self.confident&self.alpha
    C=self.out[m].mean(0)
   else:
    C=local_mean(self.out,self.confident&self.alpha,x,y,2)
    if C is None:C=local_mean(self.out,self.confident&self.alpha,x,y,3)
   self.out[y,x]=C;self.alpha[y,x]=True;self.confident[y,x]=True
 def erase(self,points):
  for x,y in points:self.alpha[y,x]=False
 def hem(self,limits,window):
  """Give ragged hair tips one continuous bottom edge.

  limits maps x -> lowest hair row kept in that column (-1 = none); inside
  `window` rows, pixels above the edge are filled and pixels below erased.
  """
  for x,bottom in limits.items():
   for y in range(window[0],window[1]+1):
    if y<=bottom and not self.alpha[y,x]:self.paint([(x,y)])
    elif y>bottom:self.alpha[y,x]=False
 def despeckle(self,min_island=8):
  for _ in range(3):
   spurs=[(x,y) for y in range(60) for x in range(60) if self.alpha[y,x]
          and sum(1 for dx,dy in N4 if inb(x+dx,y+dy) and self.alpha[y+dy,x+dx])<=1]
   for x,y in spurs:self.alpha[y,x]=False
   if spurs:self.log(self.name,'one-pixel wisps removed',spurs)
   else:break
  for comp in components(self.alpha):
   if len(comp)<min_island:
    for x,y in comp:self.alpha[y,x]=False
    self.log(self.name,'island removed',comp)
 def image(self):
  res=np.zeros((60,60,4),np.uint8);res[...,:3]=self.out.round().clip(0,255);res[...,3]=np.where(self.alpha,255,0)
  return Image.fromarray(res,'RGBA')

def make_left(log=None):
 v=SideView(ROOT/'source'/'girl_left.png',log);v.remove_background();v.refine_outline();v.refine_interior()
 # Dress showing through a split in the front lock: a lone bright speck at game scale.
 v.paint(box(9,41,11,42),sample_box=(6,43,11,45))
 # Back of the head: detached ring of a curl, and the background windows of two curls.
 v.erase(box(55,19,59,27));v.paint(box(53,21,54,25));v.paint(box(53,32,55,35))
 # Lowest hair tips at the back were interleaved with background at 1px pitch.
 v.hem({41:37,42:37,43:37,44:37,45:38,46:38,47:38,48:38,49:38,50:38,51:38,52:37,53:37,54:37,55:36,56:36,57:35,58:34,59:-1},(33,40))
 v.despeckle()
 return v.image()

def make_right(log=None):
 v=SideView(ROOT/'source'/'girl_right.png',log);v.remove_background();v.refine_outline();v.refine_interior()
 # Back of the head (left side): detached ring of a curl and its window.
 v.erase(box(0,19,3,27));v.paint(box(4,21,5,25))
 v.hem({0:-1,1:35,2:35,3:35,4:36,5:36,6:36,7:37,8:37,9:37,10:36,11:36,12:36},(33,40))
 # Front lock on the right: keep the continuous strand, drop the wisps under it.
 v.erase(box(50,36,53,40));v.erase([(56,36)])
 v.despeckle()
 return v.image()

# Both supplied side images touch the top edge. Everything sits one row lower on
# the sheet so the walking frames can lift the body by a pixel without clipping.
SIDE_DROP=1
def dropped(im,dy=SIDE_DROP):
 out=Image.new('RGBA',(60,60));out.alpha_composite(im.crop((0,0,60,60-dy)),(0,dy));return out

left_source=make_left(print)
right_source=make_right(print)
left=dropped(left_source)
right=dropped(right_source)

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

# ---------------------------------------------------------------------------
# The front view carries the torch toward the viewer (update 9).
#
# The supplied side views hold the lamp out ahead on an extended arm. From
# dead-on the same carry is foreshortened: both hands meet in front of the
# chest and the lamp is seen end-on, a dark rim around its lit lens. The lens
# uses the exact colour of the game's glow dot (renderer.js '#f5dfad') so the
# drawn lamp and the light effect merge into one. The back view keeps the
# clean silhouette - from behind, her body hides the lamp.
# ---------------------------------------------------------------------------
TORCH_HOUSING=(52,50,58)   # dark metal rim of the lamp, seen end-on
TORCH_LENS=(245,223,173)   # '#f5dfad', the colour of the game's torch dot
def raise_torch(im):
 def put(points,color):
  for x,y in points:im.putpixel((x,y),rgba(color))
 # One-handed carry, foreshortened dead-on, held LOW like the side views:
 # the right forearm runs down along the dress edge to a fist at thigh level,
 # and the lamp hangs from it seen end-on. Lowered until the on-screen lamp
 # height matches the side views exactly (game offset -15, like the left
 # view's -15 / right view's -14 - the user compared them side by side).
 # Sleeve: dress shade hugging the dress' right edge, clear of the hair lock.
 put([(37,34),(36,35),(37,35),(36,36),(37,36),(36,37),(37,37)],colors['clothShade'])
 # Fist wrapped over the lamp's handle.
 put([(35,38),(36,38),(37,38),(35,39),(36,39),(37,39)],colors['skinLight'])
 # Lamp end-on under the fist: a rounded rim around a 2x2 lit lens - the
 # lens in the exact colour of the game's glow dot ('#f5dfad') so the drawn
 # lamp and the light effect merge into one.
 put([(35,40),(38,40),(35,41),(38,41),(36,42),(37,42)],TORCH_HOUSING)
 put([(36,40),(37,40),(36,41),(37,41)],TORCH_LENS)
 return im

# Both supplied front/back drawings touch the top edge with the fringe. As
# with SIDE_DROP, everything sits one row lower on the sheet so the walking
# frames can raise the body by a pixel without clipping the hair.
FRONT_DROP=1
FRONT_LEG_ROW=LEG_ROW+FRONT_DROP  # first leg row on the sheet
front_torch=raise_torch(front)
front_base=dropped(front_torch)
back_base=dropped(back)

# Front-view leg bands on the sheet (x ranges), used to move each leg
# independently. The band between them is the transparent slit.
FRONT_LEGS={'left':(18,31),'right':(28,44)}

def svg_for(im,name,display_scale=1):
 """Lossless SVG, on the original 60x60 pixel grid. Horizontal pixel runs only."""
 lines=['<?xml version="1.0" encoding="UTF-8"?>',
  f'<svg xmlns="http://www.w3.org/2000/svg" width="{im.width*display_scale}" height="{im.height*display_scale}" viewBox="0 0 {im.width} {im.height}" shape-rendering="crispEdges">',
  f'<title>{name}</title>',
  '<desc>Front derived from the supplied girl_idle.png with its matte removed, both hands raising the end-on torch lamp so the pose matches the supplied side views\' extended arm; back is an adaptation of it (unseen details are not assertions about the original design). Left/right are the supplied girl_left.png and girl_right.png cleaned on the original 60x60 grid: white matte, floor oval and broken curl pixels removed, edge colours un-blended from the background. Walk frames reposition the legs and bob the body one pixel.</desc>']
 for y in range(im.height):
  x=0
  while x<im.width:
   c=im.getpixel((x,y));end=x+1
   while end<im.width and im.getpixel((end,y))==c:end+=1
   if c[3]:lines.append(f'<rect x="{x}" y="{y}" width="{end-x}" height="1" fill="#{c[0]:02x}{c[1]:02x}{c[2]:02x}"/>')
   x=end
 lines.append('</svg>');return '\n'.join(lines)+'\n'

# Leg layout of the supplied side views, in source (un-dropped) coordinates.
# `near` is the leg drawn in front (toe pointing the way she faces); the hem of
# the dress ends on row 47 in both images, so the legs begin on row 48.
# `travel` is how far (pixels) the near leg swings back and the far leg swings
# forward between the supplied pose and the opposite contact pose; the far foot
# of each drawing sits higher on screen, so the two amounts differ per view.
SIDE_LEGS={
 'left':{'forward':-1,'near':lambda x,y:x<=30 or (50<=y<=52 and x<=31) or (y>=53 and x<=32),'travel':(8,14)},
 'right':{'forward':1,'near':lambda x,y:x>=32,'travel':(10,12)},
}
LEG_TOP=48
def shifted(layer,dx,dy):
 out=Image.new('RGBA',(60,60));out.paste(layer,(dx,dy),layer);return out
def side_frame(source,side,frame):
 """Contact / pass / contact / pass.

 Frame 0 is the supplied pose (near foot forward). On frame 2 the near leg has
 travelled back and the far leg forward; frames 1 and 3 are the passes between
 them, with the swinging foot lifted and the body raised by one pixel. Feet
 stay on the ground line, so the sprite's anchor never moves.
 """
 spec=SIDE_LEGS[side];fwd=spec['forward']
 near=Image.new('RGBA',(60,60));far=Image.new('RGBA',(60,60))
 for y in range(LEG_TOP,60):
  for x in range(60):
   p=source.getpixel((x,y))
   if p[3]:(near if spec['near'](x,y) else far).putpixel((x,y),p)
 body=source.crop((0,0,60,LEG_TOP))
 phase=[0,.5,1,.5][frame];swing={1:'far',3:'near'}.get(frame);lift=1 if swing else 0
 near_dx,far_dx=(round(spec['travel'][0]*phase),round(spec['travel'][1]*phase))
 im=Image.new('RGBA',(60,60))
 # The hem rows are repeated under the legs so the raised body leaves no gap.
 im.alpha_composite(source.crop((0,LEG_TOP-2,60,LEG_TOP)),(0,LEG_TOP-2+SIDE_DROP))
 im.alpha_composite(shifted(far,fwd*far_dx,SIDE_DROP-(1 if swing=='far' else 0)))
 im.alpha_composite(shifted(near,-fwd*near_dx,SIDE_DROP-(1 if swing=='near' else 0)))
 im.alpha_composite(body,(0,SIDE_DROP-lift))
 return im

def mirrored_legs(base,top=FRONT_LEG_ROW):
 """The opposite contact pose: the leg band reflected around its own centre.

 Seen from the front the two contacts of a walk (left foot forward, right foot
 forward) are mirror images, so the second one needs no new drawing - and no
 frame of the cycle repeats. Only the rows below the hem are reflected, so the
 body, the hair and the hem stay exactly as drawn.
 """
 xs=[x for y in range(top,60) for x in range(60) if base.getpixel((x,y))[3]]
 lo,hi=min(xs),max(xs)
 out=base.copy()
 for y in range(top,60):
  row=[base.getpixel((x,y)) for x in range(60)]
  for x in range(60):
   sx=lo+hi-x
   out.putpixel((x,y),row[sx] if 0<=sx<60 else (0,0,0,0))
 return out

def front_frame(base,frame):
 """Stand / right-foot stride / stand / left-foot stride.

 Frame 0 is the drawing itself (feet together - it doubles as the standing
 art) and frame 2 its mirrored leg band, so the two "feet passing" poses
 alternate their shading exactly like the side views' two contacts do.
 Frames 1 and 3 are the strides: one foot stays planted toward the camera
 while the other is pushed AWAY from it - one pixel up (farther on the floor
 plane) and one pixel toward the centre (foreshortened), with the sock rows
 it loses hidden under the hem - so the feet visibly travel forward and back
 instead of only bobbing in place. On the strides the whole body also rises
 one pixel, the same bob the side views' passing frames always had, with the
 vacated hem row re-laid in the dress shade so no gap opens over the legs.
 """
 src=base if frame<2 else mirrored_legs(base)
 if frame in (0,2):return src.copy()
 back='left' if frame==1 else 'right'
 im=Image.new('RGBA',(60,60))
 bx0,bx1=FRONT_LEGS[back]
 # lifted one pixel: crop one sock row lower, so the leg also reads shorter
 im.alpha_composite(src.crop((bx0,FRONT_LEG_ROW+1,bx1,60)),(bx0+(1 if back=='left' else -1),FRONT_LEG_ROW))
 fx0,fx1=FRONT_LEGS['right' if back=='left' else 'left']
 im.alpha_composite(src.crop((fx0,FRONT_LEG_ROW,fx1,60)),(fx0,FRONT_LEG_ROW))
 # body one pixel higher on the strides: crop below the sheet's spare top row
 im.alpha_composite(src.crop((0,1,60,FRONT_LEG_ROW)),(0,0))
 # the row the rising body vacated is re-laid in the dress shade over the leg
 # span, so the hem still meets the legs (the slit itself stays open below).
 shade=rgba(colors['clothShade'])
 for x in range(19,42):im.putpixel((x,FRONT_LEG_ROW-1),shade)
 return im
sheet=Image.new('RGBA',(240,240))
for row,(name,base) in enumerate([('front',front_base),('left',left),('right',right),('back',back_base)]):
 # Frame 0 of every direction IS the standing drawing, so it is stored once:
 # girl-<name>.png/.svg are both the portrait and walk frame 0.
 (DEST/f'girl-{name}.svg').write_text(svg_for(base,f'主人公・{name}（立ち＝歩行コマ0）',8),encoding='utf8')
 base.save(DEST/f'girl-{name}.png')
 for frame in range(4):
  if name in ('left','right'):im=side_frame(left_source if name=='left' else right_source,name,frame)
  else:im=front_frame(base,frame)
  sheet.alpha_composite(im,(frame*60,row*60))
  if frame==0:
   assert im.tobytes()==base.tobytes(),(name,'frame 0 must stay identical to the standing drawing')
   continue
  (DEST/f'girl-{name}-walk-{frame}.svg').write_text(svg_for(im,f'主人公・{name} 歩行 {frame}'),encoding='utf8')
  im.save(DEST/f'girl-{name}-walk-{frame}.png')
(DEST/'girl-walk.svg').write_text(svg_for(sheet,'主人公・四方向の歩行シート'),encoding='utf8')
(DEST/'source-palette.json').write_text(json.dumps(colors,indent=2))
# No duplicate copies: every stored image is a distinct frame. The game reads
# girl-walk.svg (all 16 cells) and girl-front.png (portrait); the supplied
# artwork stays in source/.
cells=[sheet.crop((f*60,r*60,f*60+60,r*60+60)).tobytes() for r in range(4) for f in range(4)]
assert len(set(cells))==16,'the sheet still repeats a frame'
print('Generated clean front, supplied-and-cleaned left/right, back SVGs and 16 distinct frames.')
