import subprocess,base64,json,hashlib
from pathlib import Path
root=Path('public'); repo='Qam1ng/weak-robot-restaurant'; prefix='data/art/Modern_Interiors_Free_v2.2/Modern tiles_Free/'
sha=subprocess.check_output(['gh','api',f'repos/{repo}/commits/HEAD','--jq','.sha'],text=True).strip()
manifest=json.loads((root/'assets/manifest.json').read_text())
for src,dst in [('Interiors_free/32x32/Interiors_free_32x32.png','assets/interiors.png'),('Interiors_free/32x32/Room_Builder_free_32x32.png','assets/room-builder.png'),('LICENSE.txt','licenses/limezu-free.txt')]:
 path=prefix+src
 data=base64.b64decode(subprocess.check_output(['gh','api',f'repos/{repo}/contents/{path}?ref={sha}','--jq','.content']))
 (root/dst).write_bytes(data)
 manifest.append(dict(file=dst,repository=repo,path=path,commit=sha,sha256=hashlib.sha256(data).hexdigest()))
(root/'assets/manifest.json').write_text(json.dumps(manifest,indent=2))
