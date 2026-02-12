import { readFileSync } from 'node:fs';

const filepath = '/Users/paul/learning/ai-sdk/server/public/models/avatar.glb';
const buf = readFileSync(filepath);

// --- GLB Header (12 bytes) ---
const magic = buf.readUInt32LE(0);
const version = buf.readUInt32LE(4);
const totalLength = buf.readUInt32LE(8);

console.log('=== GLB Header ===');
console.log(`Magic:   0x${magic.toString(16)} (${magic === 0x46546C67 ? 'valid glTF' : 'INVALID'})`);
console.log(`Version: ${version}`);
console.log(`Length:  ${totalLength} bytes`);

// --- First chunk (JSON) starts at byte 12 ---
const chunk0Length = buf.readUInt32LE(12);
const chunk0Type = buf.readUInt32LE(16);  // 0x4E4F534A = "JSON"

console.log(`\n=== Chunk 0 ===`);
console.log(`Type:   0x${chunk0Type.toString(16)} (${chunk0Type === 0x4E4F534A ? 'JSON' : 'OTHER'})`);
console.log(`Length: ${chunk0Length} bytes`);

const jsonStr = buf.toString('utf8', 20, 20 + chunk0Length);
const gltf = JSON.parse(jsonStr);

// --- List all nodes ---
const nodes = gltf.nodes || [];
console.log(`\n=== All Nodes (${nodes.length} total) ===\n`);

nodes.forEach((node, i) => {
  const name = node.name || '(unnamed)';
  const hasChildren = node.children && node.children.length > 0;
  const childCount = hasChildren ? node.children.length : 0;
  const hasMesh = node.mesh !== undefined;
  const hasSkin = node.skin !== undefined;
  console.log(`[${String(i).padStart(3)}] ${name}${hasMesh ? '  [MESH]' : ''}${hasSkin ? '  [SKIN]' : ''}${hasChildren ? `  (${childCount} children)` : ''}`);
});

// --- Highlight bone-related nodes ---
const boneKeywords = ['head', 'neck', 'arm', 'spine', 'shoulder', 'hand', 'elbow', 'wrist', 'hips', 'chest', 'upper', 'lower', 'clavicle', 'finger', 'thumb'];

console.log('\n=== Bone-Related Nodes (head, neck, arm, spine, etc.) ===\n');

nodes.forEach((node, i) => {
  const name = node.name || '';
  const lower = name.toLowerCase();
  if (boneKeywords.some(kw => lower.includes(kw))) {
    console.log(`[${String(i).padStart(3)}] ${name}`);
  }
});

// --- Show skeleton hierarchy for root bone ---
function printTree(nodeIdx, depth = 0) {
  const node = nodes[nodeIdx];
  if (!node) return;
  const name = node.name || '(unnamed)';
  console.log('  '.repeat(depth) + name);
  if (node.children) {
    for (const childIdx of node.children) {
      printTree(childIdx, depth + 1);
    }
  }
}

// Find likely skeleton root
const rootCandidates = nodes
  .map((n, i) => ({ ...n, idx: i }))
  .filter(n => {
    const lower = (n.name || '').toLowerCase();
    return lower === 'armature' || lower === 'root' || lower === 'hips' || lower.includes('skeleton');
  });

if (rootCandidates.length > 0) {
  console.log('\n=== Skeleton Hierarchy (from root) ===\n');
  for (const root of rootCandidates) {
    console.log(`--- Root: "${root.name}" (node ${root.idx}) ---`);
    printTree(root.idx);
    console.log('');
  }
}
