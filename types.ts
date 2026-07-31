import type { CSSProperties } from 'react';

export enum NodeType {
  COMPANY = 'company',
  PERSON = 'person',
  SUMMARY = 'summary', // New type for extensive shareholding grouping
}

export interface ApiConfig {
  nzbnKey: string;
  companiesKey: string;
  disqualifiedDirectorsKey: string;
  insolvencyKey: string; // Insolvency Register API Key
  /**
   * Always true. Inactive and removed entities are part of the answer — a
   * struck-off parent is often the most interesting node on a chart — so the
   * crawl no longer offers to leave them out.
   */
  includeInactive?: boolean;
}

export type DebugCallback = (type: 'upstream' | 'downstream' | 'audit', data: any, message?: string) => void;

// New types for Network Console
export interface LogEntry {
  timestamp: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  status?: number;
  message?: string;
}

export type LoggerCallback = (entry: LogEntry) => void;

export interface NodeData {
  label: string;  // Display label (may include prefixes like "951999 - ")
  entityName?: string; // Clean entity name for API searches (no prefixes)
  nzbn?: string;
  sourceRegisterUniqueId?: string; // NZCN - Company number for Companies Office register
  type: NodeType;
  status?: string;
  entityTypeCode?: string; // e.g. "LimitedPartnershipNz"
  entityTypeDescription?: string; // e.g. "Limited Partnership"
  isTarget?: boolean; // To identify the center of the "butterfly"
  isHighlighted?: boolean;
  depth?: number; // Hops from search target (undirected BFS); 0 = target
  // Visibility/collapse tracking
  isVisible?: boolean;          // Should this node be rendered?
  isDirectLineage?: boolean;    // Is this in direct path from search root?
  isBranchExpanded?: boolean;   // Has this node's hidden branch been expanded?
  hiddenDescendantCount?: number; // Total hidden descendants (for badge)
  isCapped?: boolean;           // Node was truncated during crawl (mega-node trustee)
  cappedChildCount?: number;    // Total subsidiaries that were capped
  isExpanding?: boolean;        // Currently being lazy-loaded via expand
  appointmentDate?: string; // ISO Date string
  vacationDate?: string; // ISO Date string
  // Insolvency Status properties
  isInExternalAdmin?: boolean;
  externalAdminType?: string;
  removalCommenced?: boolean;
  hasHistoricInsolvency?: boolean;
  historicInsolvencyType?: string;
  isDisqualified?: boolean; // Person node: on the disqualified directors register (crit)
  // Person node: insolvency register match (crit regardless of discharged/current —
  // see utils/statusRamp.ts). Deduped by node id (personId), so this is set once per
  // unique person no matter how many edges/companies they're attached to.
  hasInsolvencyRecord?: boolean;
  insolvencyCurrent?: boolean; // At least one record is a current bankruptcy (includes a suspended discharge)
  // Person node: union of roles across every edge touching this node (one node per
  // person — see services/apiService.ts crawlUpstream). Drives the seal glyph/ring
  // in CustomNodes' PersonNode: 株 solid ring (shareholder), 締 dashed ring (director),
  // both → split glyph + split ring.
  roleKind?: 'shareholder' | 'director' | 'both';
  // Compare mode (FindScreen A ↔ B connection search)
  onComparePath?: boolean;      // Node lies on a shortest connection path (full ink)
  isCompareEndpoint?: boolean;  // Node is endpoint A or B (also gets isTarget for the stamp)
  // Case notes decoration — stamped by App's nodesWithAnnotations useMemo from
  // caseNotes; rendered by CustomNodes (dog-ear, Stage B) and the export viewer.
  hasNote?: boolean;
  noteFlagged?: boolean;
  // Save-point status diff (Stage C) — stamped session-only by App's
  // handleCheckChanges on nodes whose status changed since the save point;
  // never persisted. Rendered by CustomNodes as the 変 badge (bottom-left).
  diff?: {
    prevStatus: string;
    prevBucket: import('./utils/statusRamp').StatusBucket;
  };
}

export interface EdgeData {
  percentage: number;
  label: string;
  relationshipType?: 'parent' | 'subsidiary' | 'sibling' | 'common';
  isCeased?: boolean; // Role has ended (resigned/inactive) — rendered dashed ink-wash
  // Person → company edges only: which register relationship this specific edge
  // represents. A person's node-level roleKind is the union across all their edges;
  // this field is the per-edge specific (used for the edge's own dashed/solid style
  // and the "▼ Director" vs "▼ Shareholder" label — never both on one edge).
  roleKind?: 'shareholder' | 'director' | 'both';
}

export interface GraphNode {
  id: string;
  type: string;
  data: NodeData;
  position: { x: number; y: number };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  data?: EdgeData;
  animated?: boolean;
  style?: CSSProperties;
  markerEnd?: { type: string } | string; // Support for arrowheads
}

export interface GraphSnapshot {
  id: string;
  name: string;
  dateCreated: number;
  searchType: 'company' | 'person'; // NEW: Track search type
  searchQuery: string; // NEW: Store search term
  nodes: GraphNode[];
  edges: GraphEdge[];
  personResults?: PersonCompanyResult[]; // NEW: For person search snapshots
  notes?: CaseNote[]; // Case notes copied in at save time (Stage B populates)
}

// --- Cases workspace (see design/CASES_PLAN.md) ---

// A node annotation. `key` is the node's stable identity: nzbn when present,
// otherwise personId(label) from services/compareService.
export interface CaseNote {
  id: string;
  key: string; // nzbn ?? personId(label)
  tabId: string;
  nodeLabel: string;
  text: string;
  flag: boolean;
  createdAt: number;
}

// Serialized CompanyTab for the session store. Only allNodesInMemory + edges
// are persisted (visible nodes are rebuilt on load via assignDepths/layout);
// transient node fields (isHighlighted, isExpanding, selected) are stripped.
export interface PersistedCompanyTab {
  id: string;
  label: string;
  nzbn: string;
  searchQuery: string;
  allNodesInMemory: GraphNode[];
  edges: GraphEdge[];
  compare?: CompanyTab['compare'];
}

// The one implicit case in v1 — localStorage mitsuketa_session_v1.
// Individual (person) tabs are NEVER serialized here (compliance: same rule
// as person snapshots; disqualified/insolvency matches live only on them).
export interface CaseSession {
  version: 1;
  companyTabs: PersistedCompanyTab[];
  activeCompanyTabId: string | null;
  notes: CaseNote[];
  updatedAt: number;
}

// Physical address from Companies Office Entity Roles API
export interface PhysicalAddress {
  addressLines: string[];
  postCode?: string;
  countryCode?: string;
}

// NEW: Processed person search result
export interface PersonCompanyResult {
  companyName: string;
  nzbn: string;
  companyNumber?: string; // NZCN - Companies Office company number
  firstName?: string; // Director's first name from API
  lastName?: string; // Director's last name from API
  physicalAddress?: PhysicalAddress; // Residential address from API
  isDirector: boolean;
  shareholding: number; // 0-100 percentage
  status: string;
  roleType: string; // "Director", "Shareholder", or "Director & Shareholder"
  isInactive?: boolean; // If role is inactive (resigned/removed)
  resignationDate?: string; // If director resigned
  entityStatusCode?: number; // Company status code (80=Removed, 90=Inactive, etc.)
  // Enriched status fields (from NZBN entity lookup)
  entityStatusDescription?: string; // e.g. "In Liquidation", "In Receivership"
  isInExternalAdmin?: boolean; // True if in receivership/liquidation/administration
  externalAdminType?: string; // Specific type: "In Receivership", "In Liquidation", etc.
  removalCommenced?: boolean; // True if registered but removal process has started
  hasHistoricInsolvency?: boolean; // True if removed AND had insolvency history
  historicInsolvencyType?: string; // e.g. "Liquidation", "Receivership"
}

// Tab system types
export interface CompanyTab {
  id: string;
  label: string;
  nzbn: string;
  searchQuery: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  allNodesInMemory: GraphNode[];
  isLoading: boolean;
  // Present when this tab holds a Compare (A ↔ B) result rather than an org chart
  compare?: {
    aLabel: string;
    bLabel: string;
    hops: number;
    pathNodeIds: string[];
    pathEdgeIds: string[];
  };
}

export interface IndividualTab {
  id: string;
  label: string;
  searchQuery: string;
  personResults: PersonCompanyResult[];
  disqualifiedMatches: any[];
  insolvencyMatches: any[];
  isEnriching: boolean; // True while fetching NZBN enrichment data
}

/**
 * One open 地 title report.
 *
 * Deliberately NOT part of the persisted case session (utils/caseStore.ts):
 * a report holds restricted personal data — registered owners, mortgagees and
 * caveators — under the LINZ Licence for Personal Data, and the property
 * sign-in itself is memory-only by design (utils/propertySession.ts). Writing
 * reports to localStorage would quietly undo that. Memory only, every time.
 */
export interface PropertyTab {
  id: string;
  label: string;      // the title number
  titleNo: string;
  report: unknown;    // TitleReport — typed at the use site to keep types.ts free of service imports
}

// --- API Response Types (Aligned with JSON Schemas) ---

// From /entities search response
export interface EntitySearchResultItem {
  nzbn: string;
  entityName: string;
  entityStatusDescription: string;
  entityTypeCode: string;
  sourceRegisterUniqueId?: string; // NZCN - Company number
  tradingNames?: Array<{
    name: string;
  }>;
}

// From /entities search response (paginated wrapper)
export interface EntitySearchResponse {
  pageSize: number;
  page: number;
  totalItems: number;
  items: EntitySearchResultItem[];
}

// From /entities/{nzbn} (FullEntity schema)
// Updated to use "company-details" as per JSON definition
export interface NZBNFullEntity {
  nzbn: string;
  entityName: string;
  entityStatusDescription: string;
  sourceRegisterUniqueId?: string; // NZCN - Company number
  "company-details"?: {
    extensiveShareholding?: boolean;
    shareholding?: {
      shareAllocation: Array<{
        allocation: number;
        shareholder: Array<{
          type: string;
          individualShareholder?: {
            fullName?: string;
            firstName?: string;
            lastName?: string;
          };
          otherShareholder?: {
            currentEntityName?: string;
            nzbn?: string;
          };
          appointmentDate?: string;
        }>;
      }>;
    };
  };
  roles?: Array<{
    roleType: string;
    roleStatus: string;
    rolePerson?: {
      firstName?: string;
      lastName?: string;
      middleName?: string;
      fullName?: string;
    };
    roleEntity?: {
      name?: string;
      nzbn?: string;
    };
  }>;
}

// From /search (Companies Office)
export interface CompaniesRoleSearchResult {
  totalResults?: number;
  currentPage?: number;
  pageSize?: number;
  roles: Array<{
    roleType: "Director" | "DirectorShareholder" | "IndividualShareholder" | "OrganisationShareholder";
    name?: string;
    nzbn?: string;
    associatedCompanyNzbn: string;
    associatedCompanyName: string;
    associatedCompanyNumber?: string; // NZCN - Company number from Companies Office
    associatedCompanyStatusCode?: string; // Company status code
    appointmentDate?: string;
    resignationDate?: string;
    status?: string; // Role status (e.g., "inactive")
    firstName?: string;
    lastName?: string;
    middleName?: string;
    physicalAddress?: {
      addressLines?: string[];
      postCode?: string;
      countryCode?: string;
    };
    shareholdings?: Array<{
      sharePercentage?: number;
      numberOfShares?: number;
      associatedCompanyName?: string;
      associatedCompanyNzbn?: string;
      associatedCompanyNumber?: string; // NZCN - Company number
      associatedCompanyStatusCode?: string;
    }>
  }>;
  status?: number; // Added for diagnostic
}