# MaleCNS data used in Neuro Racer

Source: [MaleCNS v1.0 official downloads](https://male-cns.janelia.org/download/), accessed 2026-09-11. Attribution: MaleCNS / FlyEM, HHMI Janelia Research Campus and collaborators including Google Research. Dataset license: [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).

The game includes 30 real neuron centerline skeletons and 141 measured directed connections, selected from MaleCNS v1.0. This is a small motor subgraph spanning descending neurons and the ventral nerve cord, not the entire brain. Ten outputs are five annotated bilateral wing motor types: DLMn c-f, DVMn 1a-c, b1 MN, b2 MN and i1 MN. Each output has a distinct upstream neuron and intermediate neuron, selected by strongest available synapse count under the type constraints in the extraction script. The export includes all measured connections among the selected neurons, including cross connections. It does not fabricate anatomical edges.

Raw sources:

- `https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/body-annotations-male-cns-v1.0-minconf-0.5.feather`
- `https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/connectome-weights-male-cns-v1.0-minconf-0.5.feather`
- `https://storage.googleapis.com/flyem-male-cns/v1.0/segmentation/skeletons-malecns/skeletons-swc/{bodyId}.swc`

Raw annotation table is saved at `data/raw/annotations.feather`; selected unmodified SWC files at `data/raw/skeletons/`; selected measured edges at `data/raw/selected-edges.json`. Full connectivity is approximately 1 GB and is intentionally kept outside the repository at `/tmp/fly-weights.feather` during extraction.

## Reproduce with uv

Download the annotations and full connectivity from the links above, then run:

```sh
uv run scripts/build_circuit.py --weights /tmp/fly-weights.feather
```

The script uses inline Python dependency metadata for PyArrow. It fetches the 30 SWC files with curl, retaining original node-parent branch connectivity. Coordinates are originally in 8 nm units; the export applies a single shared centering/scaling transform to every neuron, recorded in `coordinateTransform`, and rounds normalized coordinates to five decimal places. No hand-drawn morphology is substituted.

## Biological limits

The connectome supplies anatomical geometry and synapse counts, not complete executable neural dynamics. Key stimulation, membrane thresholds, time constants, visual pulse speeds, muscle activation and racing physics are game modeling choices. Neurotransmitter signs, gap junctions, full network context, muscle mechanics and validated sensorimotor dynamics are not supplied here. The five action labels per side are an artificial game mapping to five real motor types; anatomical names alone do not establish pronation, supination or stroke-extent effects. Indirect flight muscles do not work as a simple ten-button oscillator. This is a connectome-driven game prototype, not a validated simulation of fly behavior.

## Runtime selection

The shipped worker simulates the 20 measured edges along the ten selected two-hop paths. Other measured edges among the selected neurons remain recorded in the export but are not simulated. This preserves independent playable channels without pretending that unknown transmitter signs can be recovered from synapse counts. All simulated connections remain measured connections.


## Anatomical context shells (2026-09-12)

Imported from the user's [MaleCNS Neuroglancer scene](https://neuroglancer-demo.appspot.com/#!gs://flyem-male-cns/v1.0/male-cns-v1.0.json): `fullbrain-major-shells` segments 1–3 and `vnc-neuropil-shell-v2` segment 1. These are the real ROI shells, not invented ellipsoids. Source fragment URLs, original SHA-256 hashes, output bounds and geometry counts are recorded in `public/data/brain-shells.json`. Same MaleCNS attribution and CC-BY-4.0 license as above.

Reproduce with `python scripts/build_brain_mesh.py` (requires NumPy and public network access). The script decodes Neuroglancer legacy single-resolution meshes, converts nm to the SWC 8-nm coordinate units, and applies the exact recorded circuit center and scale. It clusters vertices into 0.012-unit cells, averages their positions and removes degenerate faces to create a lightweight context mesh. Four output binaries total approximately 2 MB. Each binary contains little-endian vertex/index counts, Float32 positions and Uint32 indices. The renderer applies one additional shared transform to BOTH shells and skeletons.

The surface shader responds only near the moving pulse locations of simulated spike events. It uses a spatially limited falloff, a short decay, and a local ripple. Shells are not themselves electrically simulated: the glow is an illustrative proximity projection, not voltage measurements or a claim that spikes travel over the brain exterior. No random whole-brain activation is added. The VNC shell is included because much of the selected motor circuit is in the ventral nerve cord.

The physical keyboard now has six keys, while the underlying ten motor pathways and measured edges remain intact. W and O each stimulate two wingbeat pathways; Q/P stimulate extent pathways, E/I stimulate pitch pathways. The remaining two brake pathways remain in the dataset but have no dedicated physical key in this layout.
