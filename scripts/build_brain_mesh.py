"""Import the public MaleCNS shells, preserving anatomy and circuit alignment."""
import json, struct, urllib.request, hashlib
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
BASE='https://storage.googleapis.com/flyem-male-cns/rois/'
circuit=json.loads((ROOT/'public/data/circuit.json').read_text())
t=circuit['coordinateTransform']; manifest=[]
for group, ids in [('fullbrain-major-shells',[1,2,3]),('vnc-neuropil-shell-v2',[1])]:
 for segment in ids:
  url=BASE+group+'/mesh/'
  fragments=json.load(urllib.request.urlopen(url+str(segment)+':0'))['fragments']
  for fragment in fragments:
   raw=urllib.request.urlopen(url+fragment).read(); n=struct.unpack_from('<I',raw)[0]
   vertices=np.frombuffer(raw,dtype='<f4',count=n*3,offset=4).reshape(-1,3)
   indices=np.frombuffer(raw,dtype='<u4',offset=4+n*12)
   assert len(indices)%3==0 and indices.max()<n
   # Neuroglancer meshes are nm; circuit SWC coordinates are 8nm voxels.
   points=((vertices/8-np.array(t['center']))/t['scale']).astype('<f4')
   # Deterministic vertex clustering gives a light anatomical context shell.
   cells=np.floor(points/.012).astype(np.int32)
   _, inverse=np.unique(cells,axis=0,return_inverse=True)
   counts=np.bincount(inverse)
   reduced=np.column_stack([np.bincount(inverse,weights=points[:,a])/counts for a in range(3)]).astype('<f4')
   faces=inverse[indices].reshape(-1,3)
   faces=faces[(faces[:,0]!=faces[:,1]) & (faces[:,1]!=faces[:,2]) & (faces[:,0]!=faces[:,2])]
   points=reduced; indices=faces.astype('<u4').ravel(); n=len(points)
   name=f'{group}-{segment}.bin'; path=ROOT/'public/data'/name
   path.write_bytes(struct.pack('<II',n,len(indices))+points.tobytes()+indices.tobytes())
   manifest.append({'file':name,'source':url+fragment,'vertices':n,'triangles':len(indices)//3,'sha256':hashlib.sha256(raw).hexdigest(),'min':points.min(axis=0).tolist(),'max':points.max(axis=0).tolist()})
   print(name,n,len(indices)//3,path.stat().st_size)
(ROOT/'public/data/brain-shells.json').write_text(json.dumps({'license':'CC-BY-4.0','units':'circuit-normalized','shells':manifest},indent=2))
