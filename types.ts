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
}

export interface EdgeData {
  percentage: number;
  label: string;
  relationshipType?: 'parent' | 'subsidiary' | 'sibling' | 'common';
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
}

// NEW: Processed person search result
export interface PersonCompanyResult {
  companyName: string;
  nzbn: string;
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