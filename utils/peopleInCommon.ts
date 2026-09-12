import { GraphEdge, GraphNode, NodeType } from '../types';
import { personId } from '../services/compareService';

/**
 * People in common — pure derivation across open tabs (design/CASES_PLAN.md
 * §People in common). ZERO API calls: everything is read from graphs already
 * in memory. Identity is personId() from compareService — the single
 * person-identity normalization (uppercase, sorted tokens, P- prefix). The
 * same-name caveat applies and is surfaced in the UI footnote.
 */

// Structural input shapes — CompanyTab / IndividualTab satisfy these, but the
// derivation only depends on the fields below (keeps the self-test tiny).
export interface PeopleCompanyTabInput {
  id: string;
  label: string;
  allNodesInMemory: GraphNode[];
  edges: GraphEdge[];
}

export interface PeopleIndividualTabInput {
  id: string;
  label: string; // the searched person's name (the tab subject)
}

export interface SharedPersonAppearance {
  tabId: string;
  tabLabel: string;
  kind: 'graph-node' | 'person-tab';
  /** Company labels sharing an edge with the person in that tab (graph-node only). */
  viaCompanies: string[];
}

export interface SharedPerson {
  /** personId(label) — matches the nzbn ?? personId(label) highlight key in App. */
  key: string;
  /** Longest-seen name variant across all appearances. */
  displayName: string;
  /** One appearance per tab the person shows up in. */
  appearances: SharedPersonAppearance[];
}

/**
 * Derives the people appearing in ≥2 open tabs. Sources:
 * - person-type nodes in each company tab's allNodesInMemory (viaCompanies =
 *   labels of company nodes sharing an edge with them in that tab);
 * - each individual tab's subject name.
 * The key is personId(node.data.label) so a chip click can highlight the node
 * via the existing (nzbn ?? personId(label)) mechanic. Pure — no API calls.
 */
export const computePeopleInCommon = (
  companyTabs: PeopleCompanyTabInput[],
  individualTabs: PeopleIndividualTabInput[]
): SharedPerson[] => {
  const byKey = new Map<string, SharedPerson>();

  const record = (key: string, name: string, appearance: SharedPersonAppearance) => {
    let entry = byKey.get(key);
    if (!entry) {
      entry = { key, displayName: name, appearances: [] };
      byKey.set(key, entry);
    }
    if (name.length > entry.displayName.length) entry.displayName = name;
    entry.appearances.push(appearance);
  };

  for (const tab of companyTabs) {
    const nodeById = new Map(tab.allNodesInMemory.map((n) => [n.id, n]));

    // person node id → company labels it shares an edge with, in this tab
    const viaByNodeId = new Map<string, Set<string>>();
    for (const edge of tab.edges) {
      const s = nodeById.get(edge.source);
      const t = nodeById.get(edge.target);
      if (!s || !t) continue;
      for (const [person, other] of [[s, t], [t, s]] as const) {
        if (person.data.type !== NodeType.PERSON || other.data.type !== NodeType.COMPANY) continue;
        let via = viaByNodeId.get(person.id);
        if (!via) {
          via = new Set();
          viaByNodeId.set(person.id, via);
        }
        via.add(other.data.entityName || other.data.label);
      }
    }

    // Merge same-person nodes within the tab → exactly one appearance per (key, tab)
    const perTab = new Map<string, { name: string; via: Set<string> }>();
    for (const node of tab.allNodesInMemory) {
      if (node.data.type !== NodeType.PERSON) continue;
      const name = node.data.label.trim();
      if (!name) continue;
      const key = personId(name);
      let hit = perTab.get(key);
      if (!hit) {
        hit = { name, via: new Set() };
        perTab.set(key, hit);
      }
      if (name.length > hit.name.length) hit.name = name;
      for (const label of viaByNodeId.get(node.id) ?? []) hit.via.add(label);
    }
    for (const [key, hit] of perTab) {
      record(key, hit.name, {
        tabId: tab.id,
        tabLabel: tab.label,
        kind: 'graph-node',
        viaCompanies: [...hit.via].sort(),
      });
    }
  }

  for (const tab of individualTabs) {
    const name = tab.label.trim();
    if (!name) continue;
    record(personId(name), name, {
      tabId: tab.id,
      tabLabel: tab.label,
      kind: 'person-tab',
      viaCompanies: [],
    });
  }

  return [...byKey.values()]
    .filter((p) => p.appearances.length >= 2)
    .sort(
      (a, b) =>
        b.appearances.length - a.appearances.length ||
        a.displayName.localeCompare(b.displayName)
    );
};

// ── Minimal runnable check (plan-mandated; no test framework in this repo) ──
// Run: npx tsx -e "import('./utils/peopleInCommon.ts').then(m => m.selfTestPeopleInCommon())"
export const selfTestPeopleInCommon = (): void => {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(`peopleInCommon self-test failed: ${msg}`);
  };
  const node = (id: string, label: string, type: NodeType): GraphNode => ({
    id,
    type: 'custom',
    data: { label, type },
    position: { x: 0, y: 0 },
  });
  const edge = (source: string, target: string): GraphEdge => ({
    id: `${source}-${target}`,
    source,
    target,
  });

  // Tab 1: ACME ← John Smith; Tab 2: BOLT ← "Smith, John" (token-sorted match)
  const tabs: PeopleCompanyTabInput[] = [
    {
      id: 't1',
      label: 'ACME LTD',
      allNodesInMemory: [node('c1', 'ACME LTD', NodeType.COMPANY), node('p1', 'John Smith', NodeType.PERSON)],
      edges: [edge('p1', 'c1')],
    },
    {
      id: 't2',
      label: 'BOLT LTD',
      allNodesInMemory: [
        node('c2', 'BOLT LTD', NodeType.COMPANY),
        node('p2', 'Smith, John', NodeType.PERSON),
        node('p3', 'Only Here', NodeType.PERSON), // single-tab — must not surface
      ],
      edges: [edge('p2', 'c2'), edge('p3', 'c2')],
    },
  ];
  const individuals: PeopleIndividualTabInput[] = [{ id: 'i1', label: 'JOHN SMITH' }];

  const shared = computePeopleInCommon(tabs, individuals);
  assert(shared.length === 1, `expected 1 shared person, got ${shared.length}`);
  const p = shared[0];
  assert(p.key === personId('John Smith'), `key mismatch: ${p.key}`);
  assert(p.displayName === 'Smith, John', `longest variant expected, got "${p.displayName}"`);
  assert(p.appearances.length === 3, `expected 3 appearances, got ${p.appearances.length}`);
  assert(
    p.appearances.find((a) => a.tabId === 't1')?.viaCompanies.join() === 'ACME LTD',
    'viaCompanies for t1 should be [ACME LTD]'
  );
  assert(
    p.appearances.find((a) => a.tabId === 'i1')?.kind === 'person-tab',
    'individual tab appearance should be kind person-tab'
  );
  assert(computePeopleInCommon([tabs[0]], []).length === 0, 'single tab must yield no shared people');
  // eslint-disable-next-line no-console
  console.log('peopleInCommon self-test: ok');
};
