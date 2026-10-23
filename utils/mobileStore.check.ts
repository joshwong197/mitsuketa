import assert from 'node:assert/strict';
import { diffSnapshot } from './mobileStore';

assert.deepEqual(diffSnapshot(
    { status: 'Registered', directors: ['Ann'], holders: { 'B Ltd': 100 } },
    { status: 'In Liquidation', directors: ['Ann', 'Cy'], holders: { 'B Ltd': 60, Dee: 40 } },
), ['Status changed from Registered to In Liquidation', 'New director: Cy', 'New shareholder: Dee', 'B Ltd: 100% → 60%']);
assert.deepEqual(diffSnapshot({ roles: ['X Ltd · Director'] }, { roles: [] }), ['Role ended: X Ltd · Director']);
assert.deepEqual(diffSnapshot({ directors: ['Ann'] }, { directors: ['Ann'] }), []);
console.log('mobileStore ok');
