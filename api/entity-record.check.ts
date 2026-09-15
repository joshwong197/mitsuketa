import assert from 'node:assert/strict';
import handler from './entity-record';

async function invoke(query: Record<string, string>) {
    let statusCode = 0;
    let body: any;
    const res = {
        setHeader: () => undefined,
        status: (code: number) => { statusCode = code; return res; },
        json: (value: unknown) => { body = value; return res; },
    };
    await handler({ method: 'GET', query, headers: {} } as any, res as any);
    return { statusCode, body };
}

const society = await invoke({ sourceRegister: 'I', registerNumber: '12345' });
assert.equal(society.statusCode, 200);
assert.equal(society.body.documentsStatus, 'not_supported');
assert.equal(society.body.documentsSource.kind, 'incorporated-societies');
assert.equal(society.body.documents.length, 0);
assert.deepEqual(society.body.unavailable, []);

const bad = await invoke({ sourceRegister: 'COMPANY', registerNumber: '../bad' });
assert.equal(bad.statusCode, 400);
assert.equal(bad.body.error, 'invalid_register_number');
console.log('PASS: entity-record distinguishes source-link-only documents from invalid input');
