import assert from 'node:assert/strict';
import { mergeRegisterData } from './registerPatches';
import { NodeType, type GraphNode } from '../types';
const latest: GraphNode = { id: 'a', type: 'personNode', position: { x: 900, y: 400 }, data: {
    label: 'Fixture', type: NodeType.PERSON, isVisible: false, isBranchExpanded: true, disqualifiedCheck: 'pending',
} };
const older: GraphNode = { ...latest, position: { x: 0, y: 0 }, data: {
    ...latest.data, isVisible: true, isBranchExpanded: false, isDisqualified: true, disqualifiedCheck: 'complete',
} };
const result = mergeRegisterData([latest], [older, { ...older, id: 'removed' }]);
assert.equal(result.length, 1, 'Late checks cannot restore removed nodes');
assert.deepEqual(result[0].position, { x: 900, y: 400 }, 'Preserve user drag');
assert.equal(result[0].data.isVisible, false);
assert.equal(result[0].data.isBranchExpanded, true);
assert.equal(result[0].data.isDisqualified, true);
assert.equal(result[0].data.disqualifiedCheck, 'complete');
assert.equal(latest.data.disqualifiedCheck, 'pending', 'Do not mutate previous React state');
console.log('PASS: late register patches preserve geometry, membership and view state');
