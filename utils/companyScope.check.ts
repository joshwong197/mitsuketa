import assert from 'node:assert/strict';
import { companyNodeAllowed, immediateCompanyGraph, immediateCompanyView } from './companyScope.ts';
import { markDirectLineage, syncPeopleVisibility, expandNodeSubtree, collapseNodeSubtree } from './graphVisibility.ts';
import { applyNodeChanges, type Node } from 'reactflow';
import { entityStatus } from './entityStatus.ts';
import { NodeType, type GraphNode, type GraphEdge } from '../types.ts';
const node = (id: string, person = false): GraphNode => ({ id, type: person ? 'personNode' : 'companyNode', position: { x: 0, y: 0 }, data: { label: id, type: person ? NodeType.PERSON : NodeType.COMPANY, isTarget: id === 'target' } });
const edge = (source: string, target: string, roleKind?: 'director' | 'shareholder', isCeased = false): GraphEdge => ({ id: `${source}-${target}`, source, target, data: { percentage: 100, label: roleKind || 'Shareholder', relationshipType: 'parent', roleKind, isCeased } });
const nodes = [node('target'), node('holder'), node('grandparent'), node('subsidiary'), node('person', true), node('former', true)];
const edges = [edge('holder', 'target'), edge('grandparent', 'holder'), edge('target', 'subsidiary'), edge('person', 'target', 'director'), edge('person', 'subsidiary', 'shareholder'), edge('former', 'target', 'director', true)];
const simple = immediateCompanyGraph(nodes, edges, 'target');
assert.deepEqual(simple.nodes.map(n => n.id), ['target', 'holder', 'person']);
assert.equal(simple.nodes.find(n => n.id === 'person')?.data.roleKind, 'director');
assert.equal(simple.edges.length, 2);
assert.equal(nodes.find(n => n.id === 'target')?.data.companySearchScope, undefined);
assert.equal(entityStatus({ status: 'In Liquidation' }).bucket, 'warning');
assert.equal(entityStatus({ status: 'Removed', hasHistoricInsolvency: true }).alerts.length, 2);
assert.equal(entityStatus({ status: 'Registered', removalCommenced: true }).alerts[0].label, 'Removal commenced');
console.log('ok - immediate graph projection, original graph preserved, shared status alerts');

const graphNodes = [...nodes, node('great-grandchild'), node('branch-director', true)];
const graphEdges = [...edges, edge('subsidiary', 'great-grandchild'), edge('branch-director', 'great-grandchild', 'director')];
const initial = markDirectLineage(graphNodes, graphEdges, 'target');
assert.ok(initial.find(n => n.id === 'person')?.data.isVisible, 'Immediate director must enter controlled node state, not only a render projection');
assert.ok(!initial.find(n => n.id === 'branch-director')?.data.isVisible);
const expanded = expandNodeSubtree(initial, graphEdges, 'subsidiary');
assert.ok(expanded.find(n => n.id === 'branch-director')?.data.isVisible, 'Incoming directors follow an expanded company');
const collapsed = collapseNodeSubtree(expanded, graphEdges, 'subsidiary');
assert.ok(!collapsed.find(n => n.id === 'branch-director')?.data.isVisible, 'Branch directors follow collapse');
assert.ok(collapsed.find(n => n.id === 'person')?.data.isVisible, 'Root director remains visible after collapse');
const oldSaved = initial.map(n => n.type === 'personNode' ? { ...n, data: { ...n.data, isVisible: false } } : n);
assert.ok(syncPeopleVisibility(oldSaved, graphEdges).find(n => n.id === 'person')?.data.isVisible, 'Repair saved graphs with the legacy hidden-person flags');

const controlled = initial.filter(n => n.data.isVisible) as Node[];
const measured = applyNodeChanges([{ id: 'person', type: 'dimensions', dimensions: { width: 275, height: 64 } }], controlled);
const dragged = applyNodeChanges([{ id: 'person', type: 'position', position: { x: 615, y: 205 }, dragging: false }], measured);
const oldGraphJson = JSON.stringify(initial);
const projected = immediateCompanyView(dragged as GraphNode[], initial, graphEdges, 'target');
const renderedPerson = projected.nodes.find(n => n.id === 'person') as Node;
assert.deepEqual(renderedPerson.position, { x: 615, y: 205 }, 'Simple projection must preserve a completed drag');
assert.equal(renderedPerson.width, 275, 'React Flow measurements must survive projection');
assert.equal(renderedPerson.height, 64);
assert.equal(renderedPerson.data.roleKind, 'director', 'Simple role comes from immediate relationships, not the wider graph');
assert.equal(JSON.stringify(initial), oldGraphJson, 'Projecting the view must not mutate stored graph data');
assert.ok(projected.edges.every(e => !e.data?.isCeased && !e.data?.currentUnverified), 'Current-only rules remain enforced');
console.log('ok - directors survive layout/measurement; Simple retains drag positions; expansion/collapse and saved-graph repair');

// Evergreen: a removed company can still be a CURRENT register-listed holder.
const removedHolder = { ...node('removed-holder'), data: { ...node('removed-holder').data, status: 'Removed' } };
const formerHolder = node('former-holder');
const unverifiedHolder = node('unverified-holder');
const holderGraph = immediateCompanyGraph(
    [node('target'), removedHolder, formerHolder, unverifiedHolder],
    [edge('removed-holder', 'target'), edge('former-holder', 'target', 'shareholder', true),
        { ...edge('unverified-holder', 'target'), data: { ...edge('unverified-holder', 'target').data, currentUnverified: true } }],
    'target',
);
assert.deepEqual(holderGraph.nodes.map(n => n.id), ['target', 'removed-holder']);
assert.ok(holderGraph.nodes.every(n => companyNodeAllowed(n, 'simple', false)));
assert.equal(companyNodeAllowed(removedHolder, 'comprehensive', false), false);
assert.equal(companyNodeAllowed(removedHolder, 'comprehensive', true), true);
assert.equal(companyNodeAllowed({ ...removedHolder, data: { ...removedHolder.data, isTarget: true } }, 'comprehensive', false), true);
assert.equal(companyNodeAllowed({ ...removedHolder, type: 'personNode' }, 'comprehensive', false), true);
console.log('ok - current removed holder retained in Simple; former/unverified links still excluded; Comprehensive removed filter remains strict');
