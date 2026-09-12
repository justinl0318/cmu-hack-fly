# /// script
# dependencies = ["pyarrow>=21"]
# ///
"""uv run scripts/build_circuit.py --weights /tmp/fly-weights.feather
Official data selection; no inferred or synthetic connectome edges.
"""
import argparse, json, subprocess
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.feather as feather
ROOT=Path(__file__).resolve().parents[1]
BASE='https://storage.googleapis.com/flyem-male-cns/v1.0/'
a=argparse.ArgumentParser(); a.add_argument('--weights',default='/tmp/fly-weights.feather'); args=a.parse_args()
annotations={r['bodyId']:r for r in feather.read_table(ROOT/'data/raw/annotations.feather').to_pylist()}
weights=feather.read_table(args.weights)
def incoming(ids):
 return weights.filter(pc.is_in(weights['body_post'],value_set=pa.array(list(ids),type=pa.int64()))).to_pylist()
types=['DLMn c-f','DVMn 1a-c','b1 MN','b2 MN','i1 MN']
outputs=[]
for side in ['L','R']:
 for typ in types:
  outputs.append(min(r['bodyId'] for r in annotations.values() if r['type']==typ and r['somaSide']==side))
first=incoming(outputs); chosen=set(outputs); paths=[]
for output in outputs:
 candidates=sorted((r for r in first if r['body_post']==output and r['body_pre'] not in chosen and annotations.get(r['body_pre'],{}).get('superclass') in ['vnc_intrinsic','descending_neuron']),key=lambda r:r['weight'],reverse=True)
 edge=candidates[0]; middle=edge['body_pre']; chosen.add(middle); paths.append([middle,output])
second=incoming([p[0] for p in paths])
for p in paths:
 candidates=sorted((r for r in second if r['body_post']==p[0] and r['body_pre'] not in chosen and annotations.get(r['body_pre'],{}).get('superclass') in ['descending_neuron','vnc_intrinsic','vnc_sensory']),key=lambda r:r['weight'],reverse=True)
 inp=candidates[0]['body_pre']; chosen.add(inp); p.insert(0,inp)
selected=weights.filter(pc.and_(pc.is_in(weights['body_pre'],value_set=pa.array(sorted(chosen))),pc.is_in(weights['body_post'],value_set=pa.array(sorted(chosen))))).to_pylist()
raw=ROOT/'data/raw/skeletons'; raw.mkdir(parents=True,exist_ok=True)
def download(i):
 path=raw/f'{i}.swc'
 if not path.exists(): subprocess.run(['curl','-fLsS',BASE+f'segmentation/skeletons-malecns/skeletons-swc/{i}.swc','-o',str(path)],check=True)
 return i,path
neurons=[]
with ThreadPoolExecutor(max_workers=8) as pool:
 for i,path in pool.map(download,sorted(chosen)):
  rows=[s.split() for s in path.read_text().splitlines() if s and not s.startswith('#')]; index={int(r[0]):j for j,r in enumerate(rows)}
  points=[[float(v) for v in r[2:5]] for r in rows]; segments=[[index[int(r[6])],j] for j,r in enumerate(rows) if int(r[6]) in index]
  ann=annotations[i]; neurons.append({'id':str(i),'name':ann['instance'] or ann['type'] or str(i),'side':ann['somaSide'],'type':ann['type'],'superclass':ann['superclass'],'points':points,'segments':segments})
mins=[min(p[d] for n in neurons for p in n['points']) for d in range(3)]; maxs=[max(p[d] for n in neurons for p in n['points']) for d in range(3)]; center=[(x+y)/2 for x,y in zip(mins,maxs)]; scale=max(y-x for x,y in zip(mins,maxs))/2
for n in neurons: n['points']=[[round((p[d]-center[d])/scale,5) for d in range(3)] for p in n['points']]
channels=[{'id':str(i),'inputIds':[str(p[0])],'outputIds':[str(p[-1])],'pathIds':list(map(str,p)),'motorType':annotations[p[-1]]['type'],'side':annotations[p[-1]]['somaSide']} for i,p in enumerate(paths)]
result={'source':'MaleCNS v1.0, FlyEM / Janelia / Google Research','sourceUrl':'https://male-cns.janelia.org/download/','license':'CC-BY-4.0','coordinateTransform':{'originalUnits':'8 nm','center':center,'scale':scale},'limitations':'Real neuron skeletons and measured directed synapse counts. Selected 30-neuron wing motor subgraph, not a complete brain. Stimulation, membrane dynamics, propagation timing and mapping motor activity to game forces are artificial. Motor names do not validate the game action labels. All connections treated as excitatory by the game; neurotransmitter signs are not modeled.','neurons':neurons,'edges':[{'source':str(r['body_pre']),'target':str(r['body_post']),'weight':r['weight']} for r in selected],'channels':channels}
out=ROOT/'public/data/circuit.json'; out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(result,separators=(',',':')))
(ROOT/'data/raw/selected-edges.json').write_text(json.dumps(selected,indent=2))
print(f'{len(neurons)} neurons, {len(selected)} real edges, {sum(len(n["points"]) for n in neurons)} morphology points; {out.stat().st_size} bytes')
print(json.dumps(channels,indent=2))
