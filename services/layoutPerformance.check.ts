import assert from 'node:assert/strict';
import { layoutDepths } from '../utils/layoutDepth';
import { getLayoutedElements } from './layoutService';
import { tidyUpLayout } from './layoutOptimizer';
import { calculateHiddenDescendants } from '../utils/graphVisibility';
import { NodeType } from '../types';

Object.defineProperty(globalThis, 'window', { value: { innerWidth: 1440 }, configurable: true });
const node = (id: string, visible = true) => ({ id, type: 'companyNode', position: { x: 0, y: 0 }, data: { label: id, type: NodeType.COMPANY, isVisible: visible } });
const edge = (source: string, target: string) => ({ id: `${source}-${target}`, source, target });
const cycleNodes = ['a', 'b', 'c', 'leaf'].map(id => node(id));
const cycleEdges = [edge('a', 'b'), edge('b', 'c'), edge('c', 'a'), edge('c', 'leaf')];
const depths = layoutDepths(cycleNodes, cycleEdges);
assert.equal(depths.get('leaf'), 0);
assert.equal(depths.get('a'), 1);
assert.equal(depths.get('b'), 1);
assert.equal(depths.get('c'), 1);
const laid = getLayoutedElements(cycleNodes, cycleEdges);
const tidy = tidyUpLayout(laid.nodes, laid.edges);
assert.deepEqual(tidy.edges, cycleEdges);
assert.ok(tidy.nodes.every(n => Number.isFinite(n.position.x) && Number.isFinite(n.position.y)));

// Adding thousands of hidden relationships must not change initial geometry.
const visible = [node('root'), node('child')];
const originalEdges = [edge('root', 'child')];
const allEdges = [...originalEdges, ...Array.from({ length: 2500 }, (_, i) => edge('child', `hidden-${i}`))];
const before = getLayoutedElements(structuredClone(visible), originalEdges);
const start = performance.now();
const after = getLayoutedElements(structuredClone(visible), allEdges);
assert.deepEqual(after.nodes, before.nodes);
assert.equal(after.edges.length, 2501, 'Hidden relationships remain available for expansion/export');
assert.ok(performance.now() - start < 2000, 'Two visible nodes must not lay out 2500 hidden nodes');

const hiddenNodes = [node('root'), node('a', false), node('b', false), node('shared', false)];
const hiddenEdges = [edge('root', 'a'), edge('root', 'b'), edge('a', 'shared'), edge('b', 'shared'), edge('shared', 'a')];
assert.equal(calculateHiddenDescendants(hiddenNodes, hiddenEdges as any)[0].data.hiddenDescendantCount, 3);
assert.deepEqual(hiddenNodes.map(n => n.position), hiddenNodes.map(() => ({ x: 0, y: 0 })));
console.log('PASS: cycle-safe layout, hidden-edge geometry isolation, full edge retention, unique hidden counts');
