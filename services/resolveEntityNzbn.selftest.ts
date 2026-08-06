/**
 * Minimal runnable check for resolveEntityNzbn() (services/apiService.ts) and
 * unlinkedCompanyId() (utils/entityId.ts) — the recovery path for corporate
 * holders the register did not link to an NZBN.
 *
 * Run:
 *   npx esbuild services/resolveEntityNzbn.selftest.ts --bundle --format=cjs --platform=node | node
 * Prints "resolveEntityNzbn self-test: N assertions passed" and exits 0 on success.
 *
 * global fetch is stubbed, so this makes no network calls and needs no API key.
 */
import { resolveEntityNzbn } from './apiService';
import { unlinkedCompanyId, normaliseEntityName } from '../utils/entityId';
import { ApiConfig } from '../types';

let passed = 0;
function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  passed++;
}

const config = { nzbnKey: 'test', companiesKey: 'test' } as ApiConfig;

type StubItem = { nzbn: string; entityName: string; sourceRegisterUniqueId?: string };
let searchTerms: string[] = [];

/** Stubs the proxy: every search returns `items`, keyed by nothing else. */
function stubSearch(itemsForTerm: (term: string) => StubItem[]): void {
  searchTerms = [];
  (globalThis as any).fetch = async (url: string) => {
    const path = decodeURIComponent(new URL(url, 'http://x').searchParams.get('path') || '');
    const term = decodeURIComponent(new URL(`http://x${path}`).searchParams.get('search-term') || '');
    searchTerms.push(term);
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ pageSize: 10, page: 0, totalItems: 0, items: itemsForTerm(term) }),
      text: async () => '',
    };
  };
}

const JSWAP: StubItem = {
  nzbn: '9429040142548',
  entityName: 'J SWAP CONTRACTORS LIMITED',
  sourceRegisterUniqueId: '178106',
};

async function main(): Promise<void> {
  // 1. The reported case: name + company number, no nzbn on the shareholding
  //    record. The register number resolves it, and the name is never searched.
  {
    stubSearch(term => (term === '178106' ? [JSWAP] : []));
    const nzbn = await resolveEntityNzbn('178106', 'J SWAP CONTRACTORS LIMITED', config, '/api/proxy');
    assert(nzbn === '9429040142548', 'company number resolves to the NZBN');
    assert(searchTerms.length === 1 && searchTerms[0] === '178106', 'number searched first, name not needed');
  }

  // 2. No company number: an exact name match resolves.
  {
    stubSearch(() => [JSWAP]);
    const nzbn = await resolveEntityNzbn(undefined, 'J Swap Contractors Limited', config, '/api/proxy');
    assert(nzbn === '9429040142548', 'exact name resolves regardless of case');
  }

  // 3. A near-miss name does NOT resolve. Binding a chart to the wrong parent is
  //    worse than leaving a node unlinked, so only exact matches count.
  {
    stubSearch(() => [JSWAP, { nzbn: '9429000000001', entityName: 'J SWAP TRANSPORT LIMITED' }]);
    const nzbn = await resolveEntityNzbn(undefined, 'J SWAP LIMITED', config, '/api/proxy');
    assert(nzbn === '', 'prefix/sibling names are rejected');
  }

  // 4. Two records with the same name is ambiguous — left unlinked, not guessed.
  {
    stubSearch(() => [
      { nzbn: '9429000000002', entityName: 'SMITH FARMS LIMITED' },
      { nzbn: '9429000000003', entityName: 'SMITH FARMS LIMITED' },
    ]);
    const nzbn = await resolveEntityNzbn(undefined, 'SMITH FARMS LIMITED', config, '/api/proxy');
    assert(nzbn === '', 'duplicate names are left unresolved');
  }

  // 5. A number hit whose register number does not match is rejected, then the
  //    name attempt is made — free-text search matches loosely, so verify.
  {
    stubSearch(term =>
      term === '999999'
        ? [{ nzbn: '9429000000004', entityName: 'SOMETHING ELSE LIMITED', sourceRegisterUniqueId: '888888' }]
        : [JSWAP]
    );
    const nzbn = await resolveEntityNzbn('999999', 'J SWAP CONTRACTORS LIMITED', config, '/api/proxy');
    assert(nzbn === '9429040142548', 'unverified number hit falls through to the name');
    assert(searchTerms.length === 2, 'both attempts made');
  }

  // 6. Nothing to search on, and a transport failure, both return '' rather than throw.
  {
    stubSearch(() => []);
    assert((await resolveEntityNzbn(undefined, undefined, config, '/api/proxy')) === '', 'no identifiers → no search');
    assert(searchTerms.length === 0, 'no API call when there is nothing to search');

    (globalThis as any).fetch = async () => {
      throw new Error('network down');
    };
    assert((await resolveEntityNzbn('123456', 'DOWN LIMITED', config, '/api/proxy')) === '', 'search failure is not fatal');
  }

  // 7. Unlinked ids are deterministic — the same holder collapses to one node.
  {
    assert(unlinkedCompanyId('J SWAP CONTRACTORS LIMITED', '178106') === 'ORG-CN-178106', 'register number keys the id');
    assert(
      unlinkedCompanyId('J Swap Contractors Limited') === unlinkedCompanyId('J SWAP CONTRACTORS  LIMITED'),
      'name-keyed ids are stable across case and spacing'
    );
    assert(unlinkedCompanyId('') === 'ORG-UNKNOWN', 'empty name still yields a usable id');
    assert(normaliseEntityName('  J. Swap  Contractors, Ltd ') === 'J SWAP CONTRACTORS LTD', 'name normalisation');
  }

  console.log(`resolveEntityNzbn self-test: ${passed} assertions passed`);
}

main();
