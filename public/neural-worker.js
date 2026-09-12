/* Educational leaky integrate-and-fire model on measured connectome edges.
 * Membrane constants, edge delays, stimulation and muscle projections are game parameters,
 * not inferred biological physiology. Only output spikes generate muscle activation. */
let neurons = [], incoming = [], outgoing = [], channels = [], voltage, refractory, rates;
let pressed = new Set(), paused = true, time = 0, timer;
const keys = ['q', 'w', 'e', 'r', 't', 'a', 's', 'd', 'f', 'g'];
const dt = .005;
let pending = [];
function reset() {
  voltage = new Float64Array(neurons.length);
  refractory = new Float64Array(neurons.length);
  rates = new Float64Array(neurons.length);
  pending = []; pressed.clear(); time = 0;
}
function initialize(circuit) {
  clearInterval(timer);
  neurons = circuit.neurons || [];
  const index = new Map(neurons.map((n, i) => [String(n.id), i]));
  channels = (circuit.channels || []).map(c => ({
    inputs: (c.inputIds || []).map(id => index.get(String(id))).filter(i => i !== undefined),
    outputs: (c.outputIds || []).map(id => index.get(String(id))).filter(i => i !== undefined),
  }));
  incoming = neurons.map(() => []); outgoing = neurons.map(() => []);
  // Only the selected measured pathways are simulated. Other induced edges remain
  // context in the dataset; unknown transmitter signs make an all-excitatory
  // whole-subgraph simulation a poor model for independently learnable controls.
  const paths = (circuit.channels || []).flatMap(c => (c.pathIds || []).slice(1).map((id, i) => String(c.pathIds[i]) + '>' + String(id)));
  const selected = new Set(paths);
  const edges = (circuit.edges || []).filter(e => !selected.size || selected.has(String(e.source) + '>' + String(e.target)));
  const maxIncoming = new Float64Array(neurons.length);
  for (const e of edges) {
    const target = index.get(String(e.target));
    if (target !== undefined) maxIncoming[target] = Math.max(maxIncoming[target], Number(e.weight) || 1);
  }
  for (const e of edges) {
    const source = index.get(String(e.source)), target = index.get(String(e.target));
    if (source === undefined || target === undefined) continue;
    // Positive weights are synapse counts. Counts do not establish neurotransmitter sign.
    const strength = 1.14 * Math.sqrt((Number(e.weight) || 1) / Math.max(1, maxIncoming[target]));
    outgoing[source].push({ target, strength }); incoming[target].push(source);
  }
  reset(); paused = true;
  postMessage({ type: 'ready', neurons: neurons.length, edges: edges.length });
  timer = setInterval(tick, 20);
}
function tick() {
  if (paused) return;
  const spikes = new Set();
  for (let step = 0; step < 4; step++) {
    time += dt;
    const arrivals = pending; pending = [];
    for (const { target, strength } of arrivals) {
      if (refractory[target] <= 0) voltage[target] += strength;
    }
    const stimulation = new Set();
    channels.forEach((channel, i) => {
      if (pressed.has(keys[i])) for (const n of channel.inputs) stimulation.add(n);
    });
    for (let i = 0; i < neurons.length; i++) {
      rates[i] *= Math.exp(-dt * 7);
      refractory[i] = Math.max(0, refractory[i] - dt);
      if (refractory[i] > 0) continue;
      voltage[i] *= Math.exp(-dt / .06);
      if (stimulation.has(i)) voltage[i] += 58 * dt;
      if (voltage[i] >= 1) {
        voltage[i] = 0; refractory[i] = .025;
        rates[i] = Math.min(1, rates[i] + .29);
        spikes.add(String(neurons[i].id));
        for (const edge of outgoing[i]) pending.push(edge);
      }
    }
  }
  const activations = keys.map((_, i) => {
    const outputs = channels[i]?.outputs || [];
    return outputs.length ? outputs.reduce((a, n) => a + rates[n], 0) / outputs.length : 0;
  });
  postMessage({ type: 'frame', activations, spikes: [...spikes], time });
}
self.onmessage = ({ data }) => {
  if (data.type === 'init') initialize(data.circuit);
  if (data.type === 'input') pressed = new Set((data.pressed || []).map(k => String(k).toLowerCase()));
  if (data.type === 'pause') { paused = data.paused !== false; if (paused) pressed.clear(); }
  if (data.type === 'start' || data.type === 'resume') paused = false;
  if (data.type === 'reset') {
    reset(); paused = true;
    postMessage({ type: 'frame', activations: keys.map(() => 0), spikes: [], time });
  }
};
