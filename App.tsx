import { removedCompany } from './utils/relationshipStatus';
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
  Controls,
  MarkerType,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Panel,
} from 'reactflow';
import { Search, FolderOpen, Layers, AlertTriangle, X, Sparkles, Undo, ChevronRight, ChevronLeft } from 'lucide-react';
import { SnapshotNameDialog } from './components/SnapshotNameDialog';
import { ConfigBar } from './components/ConfigBar';
import { CommandPalette, PaletteCommand } from './components/CommandPalette';
import { FindScreen } from './components/FindScreen';
import { PropertyReport } from './components/PropertyReport';
import type { MainTab } from './components/TabBar';
import type { TitleReport as PropertyTitleReport } from './services/propertyService';
import { getSession as getPropertySession, subscribe as subscribePropertySession } from './utils/propertySession';
import { IntroAnimation, INTRO_SEEN_KEY } from './components/IntroAnimation';
import { assignDepths } from './utils/graphDepth';
import { computePersonRoleFlags } from './utils/personRoles';
import { immediateCompanyGraph } from './utils/companyScope';
import { entityStatus } from './utils/entityStatus';
import { getStatusBucket } from './utils/statusRamp';
import { CompanyNode, PersonNode, SummaryNode } from './components/CustomNodes';
import { StatusLegend } from './components/StatusLegend';
import { NodeContextMenu } from './components/NodeContextMenu';
import { NoteEditor } from './components/NoteEditor';
import { DirectorPanel } from './components/DirectorPanel';
import { EntityDetailsPanel } from './components/EntityDetailsPanel';
import { GraphScopeControl } from './components/GraphScopeControl';
import { RegisterCheckProgress, type SearchPhase } from './components/RegisterCheckProgress';
import { PersonSearchResults } from './components/PersonSearchResults';
import { ConfirmOrgChartDialog } from './components/ConfirmOrgChartDialog';
import { TabBar } from './components/TabBar';
import { CasePanel } from './components/CasePanel';
import { enrichCompanyResults, enrichGraphNodes } from './src/api/companyStatusApi';
import { enrichPersonNodes } from './src/api/personStatusApi';
import { displaySubjectName } from './utils/personName';
import { markDirectLineage, calculateHiddenDescendants, expandNodeSubtree, collapseNodeSubtree } from './utils/graphVisibility';
import { getLayoutedElements } from './services/layoutService';
import { tidyUpLayout } from './services/layoutOptimizer';
import { dispatchStats } from './utils/dispatchGate';
import { mergeRegisterData } from './utils/registerPatches';
import { generateOrgChart, searchEntities, searchEntitiesDeep, expandNodeDownstream } from './services/apiService';
import { downloadInteractiveGraphHtml, downloadPersonReportHtml, downloadTitleReportHtml } from './services/exportService';
import { extractDirectorsFromEntity } from './services/directorService';
import { ApiConfig, EntitySearchResultItem, EntitySearchResponse, GraphSnapshot, GraphNode, GraphEdge, EdgeData, LogEntry, NodeData, NodeType, NZBNFullEntity, PersonCompanyResult, CompanyTab, IndividualTab, PersonRegisterChecks, PropertyTab, CaseNote, PersistedCompanyTab } from './types';
import { loadSession, saveSession, loadSavePoints, saveSavePoints } from './utils/caseStore';
import { diffStatuses, NodeDiff } from './utils/statusDiff';
import { searchByPersonName } from './services/directorSearchService';
import { findConnection, CompareEndpoint, CompareProgress, personId } from './services/compareService';
import { loadRecentSearches, RecentSearch } from './utils/recentSearches';
import { applyCompareEmphasis } from './utils/compareEmphasis';
import { searchDisqualifiedDirectors, DisqualifiedDirector } from './src/api/disqualifiedDirectorsApi';
import { searchInsolvency, InsolvencyRecord } from './src/api/insolvencyApi';
import { BASE_API_URL, API_PATHS } from './constants';
import { Analytics } from '@vercel/analytics/react';


const DEFAULT_CONFIG: ApiConfig = {
  nzbnKey: '',
  companiesKey: '',
  disqualifiedDirectorsKey: '',
  insolvencyKey: '',
};

const nodeTypes = {
  companyNode: CompanyNode,
  personNode: PersonNode,
  summaryNode: SummaryNode,
};

const isPersonNode = (n?: GraphNode | Node): boolean =>
  n?.type === 'personNode' || (n as any)?.data?.type === 'person';

/**
 * Sumi edge styling. Matches the mockup ink tiers exactly:
 *   .edge.d1     stroke-width 2   / opacity .85  (target ↔ 1-hop)
 *   .edge.d2     stroke-width 1.3 / opacity .45  (2+ hops)
 *   .edge.person stroke-width 1.6 / opacity .7
 *   sibling      ink-wash, 1.3
 * Arrowheads are ink at ~.6 (not blue). Edge labels are lifted out of
 * data.label onto the top-level `label` and dressed to match .elabel
 * (10.5px, ink-mid, paper bg, 1px 5px pad, tabular-nums, sharp corners).
 * Bezier is React Flow's default edge type — we set nothing, so it stays.
 */
const ELABEL_STYLE: React.CSSProperties = {
  fontSize: 10.5,
  fill: 'var(--ink-mid)',
  fontVariantNumeric: 'tabular-nums',
  fontFamily: 'var(--gothic)',
};
const ELABEL_BG_STYLE: React.CSSProperties = { fill: 'var(--paper)' };
const INK_ARROW = { type: MarkerType.ArrowClosed, color: 'oklch(from var(--ink) l c h / .6)' };

const styleEdgesByDepth = <E extends Edge>(edges: E[], nodesById: Map<string, GraphNode>): E[] =>
  edges.map((edge) => {
    const { animated: _drop, style: _oldStyle, ...rest } = edge as any;
    const src = nodesById.get(edge.source);
    const tgt = nodesById.get(edge.target);
    const relType = (edge.data as any)?.relationshipType;
    const isCeased = !!(edge.data as any)?.isCeased;

    let style: React.CSSProperties;
    if (isCeased) {
      // Status ramp: ceased roles are dashed ink-wash (current = solid ink-mid)
      style = { stroke: 'var(--ink-wash)', strokeWidth: 1.4, strokeDasharray: '6 5', opacity: 0.75 };
    } else if (relType === 'sibling') {
      style = { stroke: 'var(--ink-wash)', strokeWidth: 1.3 };
    } else if (isPersonNode(src) || isPersonNode(tgt)) {
      // Status ramp: current roles are solid --ink-mid (mockup .edge-line) —
      // except a director edge, which is dashed: directors control rather than
      // own, so the line should read differently from a shareholding at a glance.
      const roleKind = (edge.data as any)?.roleKind;
      style = (roleKind === 'director' || roleKind === 'both')
        ? { stroke: 'var(--ink-mid)', strokeWidth: 1.6, strokeDasharray: '5 4', opacity: 0.8 }
        : { stroke: 'var(--ink-mid)', strokeWidth: 1.6, opacity: 0.85 };
    } else {
      const depth = Math.max(src?.data.depth ?? 2, tgt?.data.depth ?? 2);
      style = depth <= 1
        ? { stroke: 'var(--ink)', strokeWidth: 2, opacity: 0.85 }
        : { stroke: 'var(--ink)', strokeWidth: 1.3, opacity: 0.45 };
    }

    const label = (edge as any).label ?? (edge.data as any)?.label;
    return {
      ...rest,
      className: isCeased ? 'edge-ceased' : undefined,
      style,
      label,
      labelStyle: ELABEL_STYLE,
      labelBgStyle: ELABEL_BG_STYLE,
      labelBgPadding: [5, 1] as [number, number],
      labelBgBorderRadius: 0,
      markerEnd: INK_ARROW,
    } as E;
  });

const nodesToMap = (nodes: GraphNode[]): Map<string, GraphNode> =>
  new Map(nodes.map((n) => [n.id, n]));

/**
 * PersistedCompanyTab → live CompanyTab (boot hydration). Only
 * allNodesInMemory + edges were persisted, so visible nodes are rebuilt via
 * the same assignDepths → getLayoutedElements → styleEdgesByDepth path a
 * fresh org-chart load uses (compare tabs additionally re-apply emphasis).
 * Quota-stubbed tabs ({id,label,nzbn,searchQuery} only) hydrate to an empty
 * tab the user can re-search.
 */
const rehydrateTab = (pt: PersistedCompanyTab): CompanyTab => {
  const base: CompanyTab = {
    id: pt.id,
    label: pt.label,
    nzbn: pt.nzbn,
    searchQuery: pt.searchQuery,
    nodes: [],
    edges: [],
    allNodesInMemory: [],
    isLoading: false,
    openedAt: pt.openedAt,
    trail: pt.trail || [],
    viewScope: pt.viewScope,
    hideDirectors: pt.hideDirectors,
    restoredSnapshotId: pt.restoredSnapshotId,
    ...(pt.compare ? { compare: pt.compare } : {}),
  };
  try {
    if (!pt.allNodesInMemory?.length) return base;
    const depthNodes = assignDepths(computePersonRoleFlags(pt.allNodesInMemory, pt.edges), pt.edges);
    const nodesById = nodesToMap(depthNodes);
    // Compare tabs render the whole result; org charts filter to visible.
    const renderNodes = pt.compare ? depthNodes : depthNodes.filter(n => n.data.isVisible);
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      renderNodes,
      pt.edges as any
    );
    let liveNodes = layoutedNodes as any[];
    let liveEdges = styleEdgesByDepth(layoutedEdges as any, nodesById) as any[];
    if (pt.compare) {
      const emphasized = applyCompareEmphasis(liveNodes, liveEdges, pt.compare.pathNodeIds, pt.compare.pathEdgeIds);
      liveNodes = emphasized.nodes as any[];
      liveEdges = emphasized.edges as any[];
    }
    return { ...base, nodes: liveNodes as any, edges: liveEdges as any, allNodesInMemory: depthNodes };
  } catch (err) {
    console.warn(`Failed to rehydrate tab "${pt.label}"`, err);
    return base;
  }
};

function App({ entrySearch = false }: { entrySearch?: boolean }) {
  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mitsuketa_theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });

  // Apply Theme
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.dataset.theme = theme;
    localStorage.setItem('mitsuketa_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // App State — user API keys are no longer editable in the UI (settings
  // removed) but the config plumbing stays: empty keys fall back to org keys
  // server-side.
  const [config] = useState<ApiConfig>(() => {
    const saved = localStorage.getItem('mitsuketa_config');
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EntitySearchResultItem[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<EdgeData>([]);
  const [allNodesInMemory, setAllNodesInMemory] = useState<GraphNode[]>([]); // Full graph stored here
  // Snapshots (formerly "snapshots"). loadSavePoints runs the one-time
  // migration copying legacy mitsuketa_snapshots → mitsuketa_savepoints_v1.
  const [snapshots, setSnapshots] = useState<GraphSnapshot[]>(() => loadSavePoints());

  // Diagnostic State
  const [debugData, setDebugData] = useState<{
    upstream: any;
    downstream: any;
    audit: any;
    upstreamMsg?: string;
    downstreamMsg?: string;
  }>({ upstream: null, downstream: null, audit: null });

  // Network Console State
  const apiLogs = useRef<LogEntry[]>([]);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    nodeId: string;
    nodeLabel: string;
    nodeType: string;
    nzbn?: string;
    isCapped?: boolean;
    sourceRegisterUniqueId?: string;
    position: { x: number; y: number };
  } | null>(null);

  // Note Editor State (Stage B) — opened from the context menu at its position
  const [noteEditor, setNoteEditor] = useState<{
    nodeLabel: string;
    nzbn?: string;
    noteKey: string; // nzbn ?? personId(label)
    position: { x: number; y: number };
  } | null>(null);

  // Director Panel State
  const [directorPanel, setDirectorPanel] = useState<{
    companyName: string;
    position: { x: number; y: number };
    directors: Array<{
      firstName?: string;
      lastName?: string;
      middleName?: string;
      fullName?: string;
      appointmentDate?: string;
      designation?: string;
      isCorporate?: boolean;
    }>;
  } | null>(null);

  // Tidy Up State
  const [originalLayout, setOriginalLayout] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const [shouldAutoTidy, setShouldAutoTidy] = useState(false);
  const hasAutoTidiedRef = useRef(false);

  // Person Search State (legacy - kept for active tab)
  const [searchMode, setSearchMode] = useState<'company' | 'person'>('company');
  const [companySearchScope, setCompanySearchScope] = useState<'simple' | 'comprehensive'>('comprehensive');
  const [entityDetailsNzbn, setEntityDetailsNzbn] = useState<string | null>(null);
  const [personSearchResults, setPersonSearchResults] = useState<PersonCompanyResult[]>([]);
  const [personSearchName, setPersonSearchName] = useState('');
  const [disqualifiedMatches, setDisqualifiedMatches] = useState<DisqualifiedDirector[]>([]);
  const [insolvencyMatches, setInsolvencyMatches] = useState<InsolvencyRecord[]>([]);
  const [confirmChartLoad, setConfirmChartLoad] = useState<PersonCompanyResult | null>(null);

  // Case session boot hydration (mitsuketa_session_v1) — read once; the tab /
  // note state initializers below seed from it. Person (individual) tabs are
  // never in the session, so they always start empty.
  const [bootSession] = useState(() => loadSession());

  // Tab System State
  const MAX_TABS = 10;
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('company');
  const [graphTabs, setGraphTabs] = useState<CompanyTab[]>(() =>
    bootSession ? bootSession.companyTabs.map(rehydrateTab) : []
  );
  const [individualTabs, setIndividualTabs] = useState<IndividualTab[]>([]);

  const [activeCompanyTabId, setActiveCompanyTabId] = useState<string | null>(() => {
    if (!bootSession || bootSession.companyTabs.length === 0) return null;
    const ids = bootSession.companyTabs.map(t => t.id);
    return bootSession.activeCompanyTabId && ids.includes(bootSession.activeCompanyTabId)
      ? bootSession.activeCompanyTabId
      : ids[ids.length - 1];
  });
  const [activeIndividualTabId, setActiveIndividualTabId] = useState<string | null>(null);

  // 地 property tabs — memory only, never persisted. See types.ts PropertyTab
  // for why: the reports carry restricted personal data and the property
  // sign-in is deliberately memory-only, so caseStore must not see these.
  const [propertyTabs, setPropertyTabs] = useState<PropertyTab[]>([]);
  const [activePropertyTabId, setActivePropertyTabId] = useState<string | null>(null);
  const [sidebarView, setSidebarView] = useState<'case' | 'workspace'>('case');
  const activeCaseId = activeMainTab === 'company' ? activeCompanyTabId : activeMainTab === 'individual' ? activeIndividualTabId : activePropertyTabId;
  const activeCaseIdRef = useRef<string | null>(activeCaseId);
  const searchGenerations = useRef(new Map<string, number>());
  activeCaseIdRef.current = activeCaseId;
  const currentCompanyTab = graphTabs.find(tab => tab.id === activeCompanyTabId);
  const [searchPhases, setSearchPhases] = useState<Record<string, SearchPhase>>({});
  const isGraphLoading = activeMainTab === 'company' && !!currentCompanyTab?.isLoading;
  const currentIndividualTab = individualTabs.find(tab => tab.id === activeIndividualTabId);
  const trail = activeMainTab === 'company' ? currentCompanyTab?.trail || [] : currentIndividualTab?.trail || [];
  const timeLabel = (timestamp?: number) => timestamp ? new Date(timestamp).toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' }) : undefined;
  const personSearchOpened = timeLabel(currentIndividualTab?.openedAt);
  useEffect(() => {
    let searcher = getPropertySession()?.searcher;
    return subscribePropertySession(() => {
      const next = getPropertySession()?.searcher;
      if (searcher && next !== searcher) {
        setPropertyTabs([]);
        setActivePropertyTabId(null);
      }
      searcher = next;
    });
  }, []);
  // Mirror of activeCompanyTabId for async graph loads: when a fetch resolves
  // after the user has switched tabs, results must go to the tab that started
  // the load — not clobber the live state of whichever tab is now active.
  const activeCompanyTabIdRef = useRef<string | null>(null);
  useEffect(() => { activeCompanyTabIdRef.current = activeCompanyTabId; }, [activeCompanyTabId]);

  // Compare mode state (FindScreen A ↔ B connection search)
  const [compareProgress, setCompareProgress] = useState<CompareProgress | null>(null);
  const [compareNoLink, setCompareNoLink] = useState<{ hops: number; examined: number } | null>(null);
  const compareCancelRef = useRef(false);

  // Search view (full-canvas FindScreen). A fresh session opens on the search
  // view — it IS the home screen — but a restored session with company tabs
  // opens straight onto the case.
  const [searchViewOpen, setSearchViewOpen] = useState(() => entrySearch || graphTabs.length === 0);
  useEffect(() => { if (entrySearch) setSearchViewOpen(true); }, [entrySearch]);
  // Bumped on every open trigger so FindScreen remounts and its input refocuses.
  const [searchViewNonce, setSearchViewNonce] = useState(0);

  const openSearchView = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setError(null);
    setSearchViewOpen(true);
    setSearchViewNonce(n => n + 1);
  }, []);

  // Close the search view and return to a real tab, restoring that tab's
  // content (the search view may have flipped searchMode/activeMainTab, so we
  // can't just hide it and trust whatever live state is underneath).
  const closeSearchView = useCallback(() => {
    const mode: MainTab | null =
      activeMainTab === 'individual' && individualTabs.length > 0 ? 'individual'
      : activeMainTab === 'company' && graphTabs.length > 0 ? 'company'
      : activeMainTab === 'property' && propertyTabs.length > 0 ? 'property'
      : individualTabs.length > 0 ? 'individual'
      : graphTabs.length > 0 ? 'company'
      : propertyTabs.length > 0 ? 'property'
      : null;
    if (!mode) return; // nothing to return to — stay on the search home

    setSearchViewOpen(false);
    setActiveMainTab(mode);
    if (mode === 'property') {
      const tab = propertyTabs.find(t => t.id === activePropertyTabId) || propertyTabs[propertyTabs.length - 1];
      setActivePropertyTabId(tab.id);
    } else if (mode === 'company') {
      setSearchMode('company');
      const tab = graphTabs.find(t => t.id === activeCompanyTabId) || graphTabs[graphTabs.length - 1];
      setActiveCompanyTabId(tab.id);
      setSearchQuery(tab.searchQuery);
      setNodes(tab.nodes);
      setEdges(tab.edges);
      setAllNodesInMemory(tab.allNodesInMemory);
    } else {
      setSearchMode('person');
      const tab = individualTabs.find(t => t.id === activeIndividualTabId) || individualTabs[individualTabs.length - 1];
      setActiveIndividualTabId(tab.id);
      setPersonSearchResults(tab.personResults);
      setPersonSearchName(tab.label);
      setDisqualifiedMatches(tab.disqualifiedMatches);
      setInsolvencyMatches(tab.insolvencyMatches);
    }
  }, [activeMainTab, graphTabs, individualTabs, propertyTabs, activeCompanyTabId,
      activeIndividualTabId, activePropertyTabId, setNodes, setEdges]);

  // Command palette (Ctrl/Cmd+K)
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Global keyboard shortcuts: Ctrl/Cmd+K toggles the command palette; Escape
  // (with an empty query) closes the search view when there's at least one tab
  // to return to. The palette handles its own Escape and stops propagation.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (window.location.hash !== '#/app') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(open => !open);
      } else if (e.key === 'Escape' && !paletteOpen && searchViewOpen && searchQuery === '') {
        closeSearchView();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeSearchView, paletteOpen, searchViewOpen, searchQuery]);

  // Sidebar State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => window.innerWidth < 768
  );
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const SIDEBAR_MIN = 284; // rail (64) + minimum panel
  const SIDEBAR_MAX = 620;
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = Number(localStorage.getItem('mitsuketa_sidebar_width'));
    return saved >= SIDEBAR_MIN && saved <= SIDEBAR_MAX ? saved : 334;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  const startSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
    let latest = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      latest = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, ev.clientX));
      setSidebarWidth(latest);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      setIsResizingSidebar(false);
      localStorage.setItem('mitsuketa_sidebar_width', String(latest));
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Case-file trail (timestamped investigation log)
  const logTrail = useCallback((text: string, tabId?: string | null) => {
    const id = tabId || activeCaseIdRef.current;
    if (!id) return;
    const time = new Date().toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' });
    const append = <T extends { id: string; trail?: { time: string; text: string }[] }>(tab: T): T => tab.id === id ? { ...tab, trail: [...(tab.trail || []), { time, text }].slice(-50) } : tab;
    setGraphTabs(prev => prev.map(append));
    setIndividualTabs(prev => prev.map(append));
  }, []);

  // Case notes (node annotations). Stage A persists/restores them (session
  // effect below); Stage B edits them via NoteEditor / the context menu.
  const [caseNotes, setCaseNotes] = useState<CaseNote[]>(() => bootSession?.notes ?? []);

  // Save-point status diff (Stage C, design/CASES_PLAN.md §Diff). Session-only
  // — never persisted, never re-run automatically. null = no check has run
  // yet (Changes section stays hidden); [] = checked, nothing changed.
  const [caseChanges, setCaseChanges] = useState<Record<string, { diffs: NodeDiff[] | null; name: string; checking: boolean }>>({});
  const currentChanges = activeCaseId ? caseChanges[activeCaseId] : undefined;
  const nodeDiffs = currentChanges?.diffs || null;
  const lastCheckedSavePointName = currentChanges?.name || '';
  const isCheckingChanges = !!currentChanges?.checking;
  const [snapshotDialog, setSnapshotDialog] = useState<{ name: string; snapshot: GraphSnapshot; caseId: string | null } | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Intro gate
  const [showIntro, setShowIntro] = useState(() =>
    !entrySearch && typeof window !== 'undefined' && !sessionStorage.getItem(INTRO_SEEN_KEY)
  );

  const handleLog = useCallback((entry: LogEntry) => {
    apiLogs.current.push(entry);
    if (apiLogs.current.length > 1000) apiLogs.current.splice(0, 500);
  }, []);

  // AUTO-TIDY: Run after graph loads
  useEffect(() => {
    if (shouldAutoTidy && nodes.length > 0 && edges.length > 0 && !hasAutoTidiedRef.current) {
      console.log('🎨 Auto-Tidy: Running automatic layout optimization...');
      hasAutoTidiedRef.current = true;

      setTimeout(() => {
        const optimized = tidyUpLayout(nodes, edges);
        setNodes(optimized.nodes);
        setEdges(optimized.edges);
        console.log('✨ Auto-Tidy: Layout automatically optimized!');
        setShouldAutoTidy(false);
      }, 150);
    }
  }, [nodes, edges, shouldAutoTidy]);

  // Persist Config
  useEffect(() => {
    localStorage.setItem('mitsuketa_config', JSON.stringify(config));
  }, [config]);

  // Persist Save Points (person snapshots are session-only for insolvency
  // register compliance). Writes mitsuketa_savepoints_v1; the legacy
  // mitsuketa_snapshots key is read-migrated once and never written again.
  useEffect(() => {
    const persistable = snapshots.filter(s => s.searchType !== 'person');
    saveSavePoints(persistable);
  }, [snapshots]);

  // Persist the case session — the ONE debounced (~1.5s) persist point
  // (design/CASES_PLAN.md). individualTabs are intentionally NOT a dependency
  // and never written: person tabs are session-only (compliance — the same
  // rule as person snapshots; disqualified/insolvency matches live only on
  // IndividualTab and so are auto-excluded).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const result = saveSession(graphTabs, activeCompanyTabId, caseNotes);
      if (result.droppedTabLabels.length > 0) {
        setNotice(`Storage full: re-search ${result.droppedTabLabels.join(', ')} to reload its graph`);
      }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [graphTabs, activeCompanyTabId, caseNotes, logTrail]);

  // Search Logic (Level 1: Find Entity or Person)
  const runCompanySearch = async (query: string) => {
    setIsLoading(true);
    setError(null);
    setSearchResults([]);
    apiLogs.current = []; // Clear logs on new search

    try {
      const response = await searchEntitiesDeep(query, config, handleLog);
      if (response.items.length === 0) {
        setError("No entities found with that name or NZBN. Entities without an NZBN will not appear in this search.");
      } else {
        setSearchResults(response.items);
      }
    } catch (err: any) {
      setError(err.message || "Search failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    if (searchMode === 'person') {
      await handlePersonSearch(searchQuery.trim());
    } else {
      await runCompanySearch(searchQuery);
    }
  };

  // Person Search Logic
  const handlePersonSearch = async (personName: string) => {
    const tabId = `ind-${crypto.randomUUID()}`;
    const openedAt = Date.now();
    const pendingTab: IndividualTab = { id: tabId, label: personName, searchQuery: personName,
      personResults: [], disqualifiedMatches: [], insolvencyMatches: [], isEnriching: true, openedAt,
      trail: [{ time: timeLabel(openedAt)!, text: `Searching "${personName}"` }] };
    setIndividualTabs(prev => [...prev, pendingTab].slice(-MAX_TABS));
    setActiveIndividualTabId(tabId);
    setActiveMainTab('individual');
    setSearchMode('person');
    setSearchQuery(personName);
    setPersonSearchName(personName);
    setSearchViewOpen(false);
    setSidebarView('case');
    activeCaseIdRef.current = tabId;
    setIsLoading(true);
    setError(null);
    setPersonSearchResults([]);
    setDisqualifiedMatches([]); // Reset
    setInsolvencyMatches([]); // Reset
    apiLogs.current = [];

    try {
      console.log(`🔍 Searching for person: "${personName}"`);

      const registerChecks: PersonRegisterChecks = { disqualified: 'complete', insolvency: 'complete' };
      const searchPromises: Promise<any>[] = [
        searchByPersonName(personName, config.companiesKey, handleLog)
      ];

      // Always search disqualified directors (proxy handles key resolution)
      searchPromises.push(
        searchDisqualifiedDirectors(personName, config, handleLog)
          .catch(err => {
            registerChecks.disqualified = 'unavailable';
            console.warn("Disqualified Search failed", err);
            return { roles: [] };
          })
      );

      // Always search insolvency (proxy handles key resolution)
      searchPromises.push(
        searchInsolvency(personName, config, handleLog)
          .catch(err => {
            registerChecks.insolvency = 'unavailable';
            console.warn("Insolvency Search failed", err);
            return { searchResults: [] };
          })
      );

      const [personResults, disqualifiedResults, insolvencyResults] = await Promise.all(searchPromises);
      registerChecks.checkedAt = Date.now();
      setIndividualTabs(prev => prev.map(tab => tab.id === tabId ? { ...tab, registerChecks } : tab));

      if (
        personResults.length === 0 &&
        (!disqualifiedResults.roles || disqualifiedResults.roles.length === 0) &&
        (!insolvencyResults.searchResults || insolvencyResults.searchResults.length === 0)
      ) {
        if (activeCaseIdRef.current === tabId) setError(registerChecks.disqualified === 'unavailable' || registerChecks.insolvency === 'unavailable'
          ? `No company matches returned for "${personName}". One or more register checks were unavailable; try again.`
          : `No directorship, shareholding, disqualification, or insolvency records found for "${personName}".`);
        logTrail(registerChecks.disqualified === 'unavailable' || registerChecks.insolvency === 'unavailable' ? 'No company matches returned; register checks incomplete' : 'No matching records found', tabId);
        setIndividualTabs(prev => prev.map(tab => tab.id === tabId ? { ...tab, isEnriching: false } : tab));
      } else {
        // Show results immediately; NZBN status enrichment (insolvency/admin flags)
        // runs in the background and patches in below.
        if (activeCaseIdRef.current === tabId) {
          setPersonSearchResults(personResults);
          setPersonSearchName(personName);
          setDisqualifiedMatches(disqualifiedResults.roles || []);
          setInsolvencyMatches(insolvencyResults.searchResults || []);
        }
        logTrail(`Searched "${personName}" · ${personResults.length} ${personResults.length === 1 ? 'company' : 'companies'}`, tabId);

        if (disqualifiedResults.roles && disqualifiedResults.roles.length > 0) {
          console.log(`⚠️ Found ${disqualifiedResults.roles.length} disqualified director matches!`);
          logTrail(`Disqualified director match · ${disqualifiedResults.roles.length} ${disqualifiedResults.roles.length === 1 ? 'record' : 'records'}`, tabId);
        }

        if (insolvencyResults.searchResults && insolvencyResults.searchResults.length > 0) {
          console.log(`⚠️ Found ${insolvencyResults.searchResults.length} insolvency record(s)!`);
          logTrail(`Insolvency match · ${insolvencyResults.searchResults.length} ${insolvencyResults.searchResults.length === 1 ? 'record' : 'records'}`, tabId);
        }

        console.log(`✅ Found ${personResults.length} companies for "${personName}"`);

        // Create a new Individual tab
        setIndividualTabs(prev => prev.map(tab => tab.id === tabId ? { ...tab,
          personResults,
          disqualifiedMatches: disqualifiedResults.roles || [],
          insolvencyMatches: insolvencyResults.searchResults || [],
          isEnriching: personResults.length > 0
        } : tab));

        // Background NZBN status enrichment — patches insolvency/admin flags into the
        // already-visible results instead of blocking the whole screen on ~2 API calls
        // per company.
        if (personResults.length > 0) {
          enrichCompanyResults(personResults, config, handleLog)
            .then(enriched => {
              console.log(`✅ Enrichment complete for "${personName}"`);
              // Only replace the visible results if this search is still the one on screen
              if (activeCaseIdRef.current === tabId) setPersonSearchResults(enriched);
              setIndividualTabs(prev => prev.map(t =>
                t.id === tabId ? { ...t, personResults: enriched, isEnriching: false } : t
              ));
            })
            .catch(err => {
              console.warn('Enrichment failed:', err);
              setIndividualTabs(prev => prev.map(t =>
                t.id === tabId ? { ...t, isEnriching: false } : t
              ));
            });
        }
      }
    } catch (err: any) {
      if (activeCaseIdRef.current === tabId) setError(err.message || "Person search failed.");
      setIndividualTabs(prev => prev.map(tab => tab.id === tabId ? { ...tab, isEnriching: false } : tab));
      logTrail('Person search failed', tabId);
      console.error('❌ Person search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle company card click from person search — opens in Company tab directly
  const handleCompanyCardClick = (result: PersonCompanyResult) => {
    // Create a new Company tab and load the org chart
    const entity: EntitySearchResultItem = {
      nzbn: result.nzbn,
      entityName: result.companyName,
      entityStatusDescription: result.status,
      entityTypeCode: 'LTD'
    };

    // Switch to company view and load
    setActiveMainTab('company');
    handleSelectEntityInTab(entity);
  };

  // Handle load org chart confirmation (legacy — kept for backward compat)
  const handleConfirmLoadChart = async () => {
    if (!confirmChartLoad) return;
    setConfirmChartLoad(null);

    const entity: EntitySearchResultItem = {
      nzbn: confirmChartLoad.nzbn,
      entityName: confirmChartLoad.companyName,
      entityStatusDescription: confirmChartLoad.status,
      entityTypeCode: 'LTD'
    };

    setActiveMainTab('company');
    await handleSelectEntityInTab(entity);
  };

  // Tab Management Handlers
  const handleSelectEntityInTab = async (entity: EntitySearchResultItem) => {
    const tabId = `comp-${crypto.randomUUID()}`;
    const openedAt = Date.now();
    const newTab: CompanyTab = {
      id: tabId,
      label: entity.entityName,
      nzbn: entity.nzbn,
      searchQuery: entity.entityName,
      nodes: [],
      edges: [],
      allNodesInMemory: [],
      isLoading: true,
      openedAt,
      trail: [{ time: timeLabel(openedAt)!, text: `Searching "${entity.entityName}"` }],
      viewScope: companySearchScope,
      hideDirectors: false,
      hideInactiveCompanies: true,
      hideInactiveDirectors: true,
    };

    setGraphTabs(prev => {
      const updated = prev.length >= MAX_TABS ? [...prev.slice(1), newTab] : [...prev, newTab];
      return updated;
    });
    setActiveCompanyTabId(tabId);
    setActiveMainTab('company');
    setSidebarView('case');
    activeCaseIdRef.current = tabId;
    setSearchViewOpen(false); // the transient search chip is replaced by the real tab

    // Clear the live graph as we switch to the new (still-empty) tab. Without
    // this, the save-back effect (keyed on activeCompanyTabId) fires on the very
    // next commit — active is now the NEW tab but `nodes` still hold the PREVIOUS
    // tab's graph — and stamps the previous entity's chart onto the new tab.
    // handleSelectEntity repopulates these once the fetch resolves.
    setNodes([]);
    setEdges([]);
    setAllNodesInMemory([]);

    // Delegate to existing entity select logic which will populate the graph
    // (forTabId ensures late-arriving results land in THIS tab even if the
    // user switches to another tab while the chart is still loading).
    await handleSelectEntity(entity, tabId);
  };

  // Compare (A ↔ B): bidirectional BFS over the registers, then open the
  // result as a Company tab labeled "A ↔ B" with the path at full ink and
  // context dimmed. No link found → stay on FindScreen (no tab opened).
  const handleCompare = async (a: CompareEndpoint, b: CompareEndpoint, maxHops: number = 4) => {
    setCompareNoLink(null);
    setError(null);
    compareCancelRef.current = false;
    setCompareProgress({ hop: 1, entitiesExamined: 0, apiCalls: 0 });

    try {
      const result = await findConnection(a, b, { ...config, includeInactive: true }, {
        maxHops,
        onProgress: setCompareProgress,
        onLog: handleLog,
        shouldCancel: () => compareCancelRef.current,
      });

      const compareLabel = `${a.name} ↔ ${b.name}`;

      if (compareCancelRef.current) {
        setNotice(`Compare stopped: ${compareLabel}`);
        return;
      }

      if (!result.found) {
        setCompareNoLink({ hops: maxHops, examined: result.stats.entitiesExamined });
        setNotice(`No connection found within ${maxHops} hops`);
        return;
      }

      // Same pipeline as an org-chart load: depths → layout → edge styling,
      // then the compare emphasis post-pass (compose, don't replace).
      const depthNodes = assignDepths(result.nodes, result.edges);
      const nodesById = nodesToMap(depthNodes);
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        depthNodes as any,
        result.edges as any
      );
      const styledEdges = styleEdgesByDepth(layoutedEdges, nodesById);
      const { nodes: emphasizedNodes, edges: emphasizedEdges } = applyCompareEmphasis(
        layoutedNodes as any[],
        styledEdges as any[],
        result.pathNodeIds,
        result.pathEdgeIds
      );

      const tabId = `comp-${Date.now()}`;
      const newTab: CompanyTab = {
        id: tabId,
        label: compareLabel,
        nzbn: a.kind === 'company' ? a.nzbn : b.kind === 'company' ? b.nzbn : '',
        searchQuery: compareLabel,
        nodes: emphasizedNodes as any,
        edges: emphasizedEdges as any,
        allNodesInMemory: depthNodes,
        isLoading: false,
        openedAt: Date.now(),
        trail: [{ time: timeLabel(Date.now())!, text: `Connection found · ${compareLabel} · ${result.hops} ${result.hops === 1 ? 'hop' : 'hops'}` }],
        compare: {
          aLabel: a.name,
          bLabel: b.name,
          hops: result.hops,
          pathNodeIds: result.pathNodeIds,
          pathEdgeIds: result.pathEdgeIds,
        },
      };

      setGraphTabs(prev => (prev.length >= MAX_TABS ? [...prev.slice(1), newTab] : [...prev, newTab]));
      setActiveCompanyTabId(tabId);
      setActiveMainTab('company');
      setSearchMode('company');
      setSearchViewOpen(false);
      setNodes(emphasizedNodes as any);
      setEdges(emphasizedEdges as any);
      setAllNodesInMemory(depthNodes);

    } catch (err: any) {
      setError(err.message || 'Compare failed.');
    } finally {
      setCompareProgress(null);
    }
  };

  const handleCompareCancel = () => {
    compareCancelRef.current = true;
  };

  // Company suggestions for the Compare slot inputs (selecting locks {nzbn,name})
  const fetchCompareSuggestions = useCallback(async (q: string): Promise<EntitySearchResultItem[]> => {
    try {
      const response = await searchEntities(q, config, handleLog, 0);
      return response.items;
    } catch {
      return [];
    }
  }, [config, handleLog]);

  const handleMainTabChange = (tab: MainTab) => {
    setActiveMainTab(tab);
    setSidebarView('case');

    // BUG 1 — while the search view is open, the main-tab buttons are just the
    // other face of FindScreen's Companies/People/Property mode line. Don't
    // switch tab content; only flip the search mode so both controls stay one
    // fact. (FindScreen's own mode line mirrors this by setting activeMainTab.)
    if (searchViewOpen) {
      if (tab !== 'property') {
        setSearchMode(tab === 'individual' ? 'person' : 'company');
        setSearchResults([]);
        setError(null);
      }
      return;
    }

    if (tab === 'property') {
      // No open report to return to — land on the property face of the search.
      if (propertyTabs.length === 0) openSearchView();
      return;
    }

    // Not searching: this is a real tab switch — restore the active tab's saved
    // state so its chart / person results, case file and exports all come back.
    // If the target mode has no tab to show, fall back to the search home.
    if (tab === 'individual') {
      setSearchMode('person');
      const activeTab = individualTabs.find(t => t.id === activeIndividualTabId);
      if (activeTab) {
        setPersonSearchResults(activeTab.personResults);
        setPersonSearchName(activeTab.label);
        setDisqualifiedMatches(activeTab.disqualifiedMatches);
        setInsolvencyMatches(activeTab.insolvencyMatches);
      } else if (individualTabs.length === 0) {
        openSearchView();
      }
    } else {
      setSearchMode('company');
      // Restore the active company tab's graph. Previously this branch only set
      // searchMode and leaned on whatever was still in the live `nodes` — so if
      // those had been cleared (e.g. after viewing a person tab / snapshot) the
      // graph, case file and exports vanished even though the tab still held data.
      const activeTab = graphTabs.find(t => t.id === activeCompanyTabId);
      if (activeTab) {
        setSearchQuery(activeTab.searchQuery);
        setNodes(activeTab.nodes);
        setEdges(activeTab.edges);
        setAllNodesInMemory(activeTab.allNodesInMemory);
      } else if (graphTabs.length === 0) {
        openSearchView();
      }
    }
  };

  /**
   * A title report opens as its own tab, exactly like a chart or a person
   * result: it gets a chip, it survives switching to Company or Individual, and
   * it can be exported. Re-opening a title already open just focuses that tab
   * rather than stacking duplicates.
   */
  const handleOpenPropertyReport = (report: PropertyTitleReport, titleNo: string) => {
    const existing = propertyTabs.find(t => t.titleNo === titleNo);
    if (existing) {
      setPropertyTabs(prev => prev.map(t => (t.id === existing.id ? { ...t, report, label: report.address || titleNo } : t)));
      setActivePropertyTabId(existing.id);
    } else {
      const id = `property-${titleNo}-${Date.now()}`;
      setPropertyTabs(prev => [...prev, { id, label: report.address || titleNo, titleNo, report }].slice(-MAX_TABS));
      setActivePropertyTabId(id);
    }
    setActiveMainTab('property');
    setSearchViewOpen(false);
  };

  const handleSubTabClick = (tabId: string) => {
    setSidebarView('case');
    setSearchViewOpen(false); // clicking a real tab closes the search view
    if (activeMainTab === 'property') {
      setActivePropertyTabId(tabId);
      return;
    }
    if (activeMainTab === 'company') {
      setSearchMode('company'); // keep search mode in step with the tab we land on
      setActiveCompanyTabId(tabId);
      const tab = graphTabs.find(t => t.id === tabId);
      if (tab) {
        setSearchQuery(tab.searchQuery);
        // Restore graph data from tab
        setNodes(tab.nodes);
        setEdges(tab.edges);
        setAllNodesInMemory(tab.allNodesInMemory);
      }
    } else {
      setSearchMode('person');
      setActiveIndividualTabId(tabId);
      const tab = individualTabs.find(t => t.id === tabId);
      if (tab) {
        setPersonSearchResults(tab.personResults);
        setPersonSearchName(tab.label);
        setDisqualifiedMatches(tab.disqualifiedMatches);
        setInsolvencyMatches(tab.insolvencyMatches);
      }
    }
  };

  // Boot restore: after a session hydration, push the active company tab onto
  // the canvas exactly the way a tab click does (same path as
  // handleSubTabClick), once, on mount. activeMainTab starts as 'company' so
  // the company branch is taken.
  const bootRestoredRef = useRef(false);
  useEffect(() => {
    if (bootRestoredRef.current) return;
    bootRestoredRef.current = true;
    if (new URLSearchParams(window.location.search).get('property') === '1') {
      setActiveMainTab('property'); setSearchViewOpen(true);
      window.history.replaceState(null, '', '/#/app');
      return;
    }
    // The root route opens FindScreen. Keep saved tabs available without
    // mounting their graph or overriding the search view.
    if (entrySearch) return;
    if (activeCompanyTabId && graphTabs.some(t => t.id === activeCompanyTabId)) {
      handleSubTabClick(activeCompanyTabId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Command palette: jump to any tab regardless of the current main tab
  // (handleSubTabClick only reaches tabs in the active mode).
  const jumpToTab = (kind: MainTab, tabId: string) => {
    setSidebarView('case');
    activeCaseIdRef.current = tabId;
    setSearchViewOpen(false);
    setActiveMainTab(kind);
    if (kind === 'property') {
      setActivePropertyTabId(tabId);
      return;
    }
    if (kind === 'company') {
      setSearchMode('company');
      setActiveCompanyTabId(tabId);
      const tab = graphTabs.find(t => t.id === tabId);
      if (tab) {
        setSearchQuery(tab.searchQuery);
        setNodes(tab.nodes);
        setEdges(tab.edges);
        setAllNodesInMemory(tab.allNodesInMemory);
      }
    } else {
      setSearchMode('person');
      setActiveIndividualTabId(tabId);
      const tab = individualTabs.find(t => t.id === tabId);
      if (tab) {
        setPersonSearchResults(tab.personResults);
        setPersonSearchName(tab.label);
        setDisqualifiedMatches(tab.disqualifiedMatches);
        setInsolvencyMatches(tab.insolvencyMatches);
      }
    }
  };

  // Command palette: re-run a recent search on the Find screen.
  const runRecentSearch = (r: RecentSearch) => {
    openSearchView();
    setSearchQuery(r.q);
    setSearchMode(r.mode);
    setActiveMainTab(r.mode === 'person' ? 'individual' : 'company');
    if (r.mode === 'person') void handlePersonSearch(r.q);
    else void runCompanySearch(r.q);
  };

  // Built fresh each time the palette opens (recents come from localStorage).
  const buildPaletteCommands = (): PaletteCommand[] => [
    ...graphTabs.map<PaletteCommand>(t => ({
      id: `tab-${t.id}`,
      group: 'Open tabs',
      label: t.label,
      hint: t.nzbn,
      run: () => jumpToTab('company', t.id),
    })),
    ...individualTabs.map<PaletteCommand>(t => ({
      id: `tab-${t.id}`,
      group: 'Open tabs',
      label: t.label,
      hint: 'Individual',
      run: () => jumpToTab('individual', t.id),
    })),
    ...loadRecentSearches().map<PaletteCommand>((r, i) => ({
      id: `recent-${i}`,
      group: 'Recent searches',
      label: r.q,
      hint: r.mode === 'person' ? 'People' : 'Companies',
      run: () => runRecentSearch(r),
    })),
    {
      id: 'action-theme',
      group: 'Actions',
      label: 'Toggle theme',
      hint: theme === 'dark' ? 'To light' : 'To dark',
      run: toggleTheme,
    },
    {
      id: 'action-find',
      group: 'Actions',
      label: 'Go to Find screen',
      run: openSearchView,
    },
  ];

  const handleSubTabClose = (tabId: string) => {
    if (activeMainTab === 'property') {
      setPropertyTabs(prev => {
        const updated = prev.filter(t => t.id !== tabId);
        if (activePropertyTabId === tabId) {
          const newActive = updated.length > 0 ? updated[updated.length - 1].id : null;
          setActivePropertyTabId(newActive);
          // No report left to show — back to the search home, which reopens on
          // the property face because the session is still unlocked.
          if (!newActive) openSearchView();
        }
        return updated;
      });
      return;
    }
    if (activeMainTab === 'company') {
      setGraphTabs(prev => {
        const updated = prev.filter(t => t.id !== tabId);
        if (activeCompanyTabId === tabId) {
          const newActive = updated.length > 0 ? updated[updated.length - 1].id : null;
          setActiveCompanyTabId(newActive);
          if (newActive) {
            const tab = updated.find(t => t.id === newActive);
            if (tab) {
              setNodes(tab.nodes);
              setEdges(tab.edges);
              setAllNodesInMemory(tab.allNodesInMemory);
            }
          } else {
            setNodes([]);
            setEdges([]);
            openSearchView(); // no company tab left to show — back to the search home
          }
        }
        return updated;
      });
    } else {
      setIndividualTabs(prev => {
        const updated = prev.filter(t => t.id !== tabId);
        if (activeIndividualTabId === tabId) {
          const newActive = updated.length > 0 ? updated[updated.length - 1].id : null;
          setActiveIndividualTabId(newActive);
          if (newActive) {
            const tab = updated.find(t => t.id === newActive);
            if (tab) {
              setPersonSearchResults(tab.personResults);
              setPersonSearchName(tab.label);
              setDisqualifiedMatches(tab.disqualifiedMatches);
              setInsolvencyMatches(tab.insolvencyMatches);
            }
          } else {
            setPersonSearchResults([]);
            setPersonSearchName('');
            setDisqualifiedMatches([]);
            setInsolvencyMatches([]);
            openSearchView(); // no individual tab left to show — back to the search home
          }
        }
        return updated;
      });
    }
  };

  // Save current graph state back to the active company tab whenever nodes/edges change
  useEffect(() => {
    if (activeMainTab === 'company' && !searchViewOpen && activeCompanyTabId && nodes.length > 0) {
      setGraphTabs(prev => prev.map(t =>
        t.id === activeCompanyTabId
          ? { ...t, nodes: nodes as any, edges: edges as any, allNodesInMemory }
          : t
      ));
    }
  }, [nodes, edges, allNodesInMemory, activeCompanyTabId, activeMainTab, searchViewOpen]);

  // Selection Logic (Level 2: Build Graph)
  // forTabId: the company tab this load belongs to. If the user switches away
  // before the fetch resolves, results are stamped into that tab's stored
  // entry instead of the live canvas (which by then shows a different tab).
  const handleSelectEntity = async (entity: EntitySearchResultItem, forTabId?: string, scope = companySearchScope) => {
    const originId = forTabId || activeCompanyTabId;
    const generationKey = originId || 'current';
    const generation = (searchGenerations.current.get(generationKey) || 0) + 1;
    searchGenerations.current.set(generationKey, generation);
    const current = () => searchGenerations.current.get(generationKey) === generation;
    const setPhase = (phase: SearchPhase) => {
      if (current()) setSearchPhases(prev => ({ ...prev, [generationKey]: phase }));
    };
    setPhase('mapping');
    // End-to-end timer: search click → interactive chart, and → fully enriched.
    const loadStart = performance.now();
    const elapsed = () => ((performance.now() - loadStart) / 1000).toFixed(2);
    setGraphTabs(prev => prev.map(t => t.id === originId ? { ...t, isLoading: true, graphIncomplete: true, hideDirectors: scope === 'simple' ? false : t.hideDirectors } : t));
    if (!originId || activeCaseIdRef.current === originId) setSearchQuery(entity.entityName);
    setError(null);
    hasAutoTidiedRef.current = false; // Reset for new graph
    setDebugData({ upstream: null, downstream: null, audit: null });

    try {
      // Pass debug callback and logger
      const graph = await generateOrgChart(
        entity.nzbn,
        { ...config, includeInactive: true, companySearchScope: scope },
        (type, data, message) => {
          setDebugData(prev => {
            if (type === 'audit') {
              return { ...prev, audit: data };
            }
            return {
              ...prev,
              [type]: data,
              [`${type}Msg`]: message
            };
          });
        },
        handleLog,
        undefined,
        preview => {
          if (!current()) return;
          const immediate = assignDepths(computePersonRoleFlags(markDirectLineage(preview.nodes, preview.edges, entity.nzbn), preview.edges), preview.edges)
            .map(n => n.data.type === 'person' ? { ...n, data: { ...n.data, disqualifiedCheck: 'pending' as const, insolvencyCheck: 'pending' as const } } : n);
          const layout = getLayoutedElements(immediate, preview.edges as unknown as Edge[]);
          setGraphTabs(prev => prev.map(t => t.id === originId ? {
            ...t, nodes: layout.nodes as any, edges: layout.edges as any, allNodesInMemory: immediate, isLoading: true, viewScope: scope,
          } : t));
          if (!originId || activeCaseIdRef.current === originId) {
            setAllNodesInMemory(immediate); setNodes(layout.nodes); setEdges(layout.edges);
          }
          console.log(`⏱️ Initial relationship preview ${elapsed()}s (${immediate.length} entities; wider network still loading)`);
        }
      );

      if (!current()) return;
      if (graph.nodes.length === 0) {
        setPhase('incomplete');
        if (!originId || activeCaseIdRef.current === originId) setError("No corporate structure found for this entity.");
      } else {
        // Structure pipeline — everything that decides positions, depths and
        // edges. None of it depends on the register/status enrichment, so it can
        // render before those calls come back.
        const processingStart = performance.now();
        let processedNodes = markDirectLineage(graph.nodes, graph.edges, entity.nzbn);
        processedNodes = processedNodes.map(n => n.data.type === 'person'
          ? { ...n, data: { ...n.data, disqualifiedCheck: 'pending' as const, insolvencyCheck: 'pending' as const } } : n);
        processedNodes = calculateHiddenDescendants(processedNodes, graph.edges);
        console.log(`⏱️ Visibility processing ${((performance.now() - processingStart) / 1000).toFixed(3)}s`);
        const depthNodes = assignDepths(computePersonRoleFlags(processedNodes, graph.edges), graph.edges);
        const nodesById = nodesToMap(depthNodes);
        const visibleNodes = depthNodes.filter(n => n.data.isVisible);
        const layoutStart = performance.now();
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
          visibleNodes,
          graph.edges as unknown as Edge[]
        );
        const optimized = tidyUpLayout(layoutedNodes, layoutedEdges);
        console.log(`⏱️ Layout ${((performance.now() - layoutStart) / 1000).toFixed(3)}s (${visibleNodes.length} visible / ${graph.nodes.length} total nodes)`);
        const finalEdges = styleEdgesByDepth(optimized.edges, nodesById);

        // PROGRESSIVE RENDER: paint the chart now, then stream the register/status
        // flags in when they resolve. Enrichment never moves a node or changes an
        // edge — it only adds status/alert fields — so first paint no longer waits
        // on dozens of register calls.
        setGraphTabs(prev => prev.map(t => t.id === originId
          ? { ...t, nodes: optimized.nodes as any, edges: finalEdges as any, allNodesInMemory: depthNodes, isLoading: false, graphIncomplete: false, viewScope: scope }
          : t));
        if (!originId || activeCaseIdRef.current === originId) {
          setAllNodesInMemory(depthNodes);
          setNodes(optimized.nodes);
          setEdges(finalEdges);
        }

        const mapName = depthNodes.find(n => n.data.isTarget)?.data.label || entity.entityName;
        logTrail(`Mapped ${mapName} · ${visibleNodes.length} entities`, originId);
        console.log(`⏱️ Chart ready in ${elapsed()}s (${visibleNodes.length} entities) — register flags loading…`);
        console.log('Request metrics at chart ' + JSON.stringify(dispatchStats()));
        setPhase('checking');
        requestAnimationFrame(() => setTimeout(() => {
          if (current()) console.log(`⏱️ Chart paint opportunity ${elapsed()}s`);
        }, 0));

        // Background enrichment: patch status + register flags into the nodes that
        // are already on screen. Merge order keeps depth/roleKind (which the view
        // filters rely on) and overlays the enriched status/flag fields.
        try {
          const publishChecks = (updates: GraphNode[]) => {
            if (!current()) return;
            setGraphTabs(prev => prev.map(t => t.id === originId ? {
              ...t, nodes: mergeRegisterData(t.nodes as unknown as GraphNode[], updates) as any,
              allNodesInMemory: mergeRegisterData(t.allNodesInMemory, updates),
            } : t));
            if (!originId || activeCaseIdRef.current === originId) {
              setAllNodesInMemory(latest => mergeRegisterData(latest, updates));
              setNodes(latest => mergeRegisterData(latest as unknown as GraphNode[], updates) as any);
            }
          };
          const [companyEnriched, personEnriched] = await Promise.all([
            enrichGraphNodes(processedNodes, { ...config, includeInactive: true }, handleLog).then(result => {
              publishChecks(result.filter(n => n.data.type === 'company')); return result;
            }),
            enrichPersonNodes(processedNodes, config, handleLog, 16, '/api/proxy', publishChecks),
          ]);
          if (!current()) return;
          const enrichedById = new Map<string, GraphNode['data']>();
          processedNodes.forEach((n, i) => {
            if (n.data.type === 'company') enrichedById.set(companyEnriched[i].id, companyEnriched[i].data);
            else if (n.data.type === 'person') enrichedById.set(personEnriched[i].id, personEnriched[i].data);
          });
          // Enrichment owns status fields, not positions, visibility or expansion.
          const fields = ['entityStatusDescription', 'status', 'isInExternalAdmin', 'externalAdminType', 'removalCommenced', 'hasHistoricInsolvency', 'historicInsolvencyType', 'isDisqualified', 'hasInsolvencyRecord', 'insolvencyCurrent', 'disqualifiedCheck', 'insolvencyCheck', 'companyCheck'] as const;
          const patch = (list: GraphNode[]): GraphNode[] => list.map(n => {
            const enriched = enrichedById.get(n.id);
            if (!enriched) return n;
            const statusPatch = Object.fromEntries(fields.filter(key => key in enriched).map(key => [key, enriched[key]]));
            return { ...n, data: { ...n.data, ...statusPatch } };
          });
          const enrichedMemory = patch(depthNodes);

          setGraphTabs(prev => prev.map(t => t.id === originId
            ? { ...t, nodes: patch(t.nodes as unknown as GraphNode[]) as any, allNodesInMemory: patch(t.allNodesInMemory) }
            : t));
          if (!originId || activeCaseIdRef.current === originId) {
            setAllNodesInMemory(latest => patch(latest));
            setNodes(latest => patch(latest as unknown as GraphNode[]) as any);
          }

          const flagCount = enrichedMemory.filter(n =>
            n.data.isInExternalAdmin || n.data.hasHistoricInsolvency || n.data.removalCommenced
          ).length;
          if (flagCount > 0) logTrail(`Flags · ${flagCount} ${flagCount === 1 ? 'entity' : 'entities'}`, originId);
          console.log(`⏱️ Total load ${elapsed()}s — chart + register requests settled (${flagCount} flagged; inspect unavailable checks)`);
          console.log('Request metrics at completion ' + JSON.stringify(dispatchStats()));
          setPhase('complete');
        } catch (enrichErr) {
          // The chart is already usable; a register-check failure must not blank it.
          console.warn('Enrichment failed (chart already rendered):', enrichErr);
          setPhase('interrupted');
        }
      }
    } catch (err: any) {
      setPhase('incomplete');
      if (current() && (!originId || activeCaseIdRef.current === originId)) setError(err.message || "Failed to fetch corporate map.");
      logTrail('Search failed', originId);
    } finally {
      // Stop the tab's loading pulse even when the load failed or came back
      // empty (the save-back effect only clears it on a successful stamp).
      if (forTabId && current()) {
        setGraphTabs(prev => prev.map(t =>
          t.id === forTabId && t.isLoading ? { ...t, isLoading: false } : t
        ));
      }
    }
  };

  const deleteSnapshot = (snapshotId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent loading the snapshot
    if (confirm('Delete this snapshot?')) {
      const updated = snapshots.filter(s => s.id !== snapshotId);
      setSnapshots(updated); // useEffect handles localStorage persistence
    }
  };


  const [isExportingHtml, setIsExportingHtml] = useState(false);

  const activePropertyTab = propertyTabs.find(t => t.id === activePropertyTabId) ?? null;

  /** The report downloads unfiltered — a filtered record is a misleading one. */
  const exportPropertyReport = async (tab: PropertyTab) => {
    setIsExportingHtml(true);
    try {
      await downloadTitleReportHtml(tab.report as PropertyTitleReport);
      setNotice('HTML report prepared for download');
    } catch (err) {
      console.error('Failed to export title report:', err);
      setError('Failed to export the title report');
    } finally {
      setIsExportingHtml(false);
    }
  };

  const exportAsHtml = async () => {
    if (activeMainTab === 'company' && currentCompanyTab?.graphIncomplete) {
      setNotice('The relationship network is still incomplete. Wait for it to finish before exporting.');
      return;
    }
    setIsExportingHtml(true);
    try {
      if (activeMainTab === 'individual' && personSearchResults.length > 0) {
        await downloadPersonReportHtml({
          personName: personSearchName,
          results: personSearchResults,
          disqualified: disqualifiedMatches,
          insolvency: insolvencyMatches,
          registerChecks: currentIndividualTab?.registerChecks,
        });
      } else if (allNodesInMemory.length > 0) {
        const target = allNodesInMemory.find(n => n.data.isTarget) || allNodesInMemory[0];
        const { loadEntityRecord } = await import('./services/entityRecordService');
        let record;
        let recordUnavailable;
        if (target.data.nzbn) {
          try { record = await loadEntityRecord(target.data.nzbn, config); }
          catch { recordUnavailable = 'The register record could not be retrieved when this file was exported.'; }
        }
        await downloadInteractiveGraphHtml({
          title: target.data.entityName || target.data.label,
          nzbn: target.data.nzbn,
          searchQuery,
          nodes: graphScope === 'simple' ? immediateCompanyGraph(allNodesInMemory, edges as unknown as GraphEdge[], target.id).nodes : allNodesInMemory,
          edges: graphScope === 'simple' ? immediateCompanyGraph(allNodesInMemory, edges as unknown as GraphEdge[], target.id).edges : edges as unknown as GraphEdge[],
          notes: caseNotes.filter((n) => n.tabId === activeCompanyTabId),
          record, recordUnavailable,
        });
      }
      setNotice('HTML report prepared for download');
    } catch (err) {
      console.error('Failed to export HTML:', err);
      setError('Failed to export as HTML');
    } finally {
      setIsExportingHtml(false);
    }
  };

  const exportSnapshot = (snap: GraphSnapshot) => {
    const json = JSON.stringify(snap, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `snapshot-${snap.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Snapshot prepared for download');
  };

  const exportAllSnapshots = () => {
    const collection = sidebarView === 'workspace' ? snapshots : scopedSnapshots;
    if (!collection.length) return;
    const json = JSON.stringify(collection, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `mitsuketa-all-snapshots-${new Date().toISOString().split('T')[0]}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Snapshots prepared for download');
  };

  // (The file-input ref for importing lives inside CasePanel now.)
  const handleImportSnapshot = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);

        const imported = Array.isArray(parsed) ? parsed : [parsed];
        if (!imported.length || imported.length > 100 || imported.some(s =>
          !s || typeof s.name !== 'string' || !['company', 'person'].includes(s.searchType) ||
          !Array.isArray(s.nodes) || !Array.isArray(s.edges) ||
          (s.searchType === 'person' && !Array.isArray(s.personResults)) ||
          s.nodes.some((n: any) => typeof n?.id !== 'string' || !n?.data || typeof n.data.label !== 'string') ||
          s.edges.some((e: any) => typeof e?.source !== 'string' || typeof e?.target !== 'string'))) {
          setError('Invalid snapshot file'); return;
        }
        const newSnapshots = imported.map(s => ({ ...s, id: crypto.randomUUID(),
          name: `${s.name} (Imported)`, dateCreated: Date.now() } as GraphSnapshot));
        setSnapshots(prev => [...newSnapshots, ...prev]);
        setNotice(`${newSnapshots.length} snapshot${newSnapshots.length === 1 ? '' : 's'} imported`);

      } catch (err) {
        console.error("Import failed", err);
        setError("Failed to import snapshot");
      }
    };
    reader.readAsText(file);
    // Reset inputs
    event.target.value = '';
  };

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const label = node.data.label;
    const nzbn = node.data.nzbn;

    setNodes((nds) =>
      nds.map((n) => {
        const match = n.data.label === label || (nzbn && n.data.nzbn === nzbn);
        return {
          ...n,
          data: { ...n.data, isHighlighted: match }
        };
      })
    );
  }, [setNodes]);

  const handlePaneClick = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, isHighlighted: false } })));
  }, [setNodes]);

  // ── Case notes (Stage B) ────────────────────────────────────────────────
  // One note per node identity: key = nzbn ?? personId(label). "Add note" on
  // an already-annotated node opens the existing note for editing.

  const openNoteEditor = (_nodeId: string, nodeLabel: string, nzbn?: string) => {
    const position = contextMenu?.position ?? { x: window.innerWidth / 2 - 140, y: window.innerHeight / 3 };
    setContextMenu(null); // the editor takes over the menu's position
    setNoteEditor({ nodeLabel, nzbn, noteKey: nzbn || personId(nodeLabel), position });
  };

  const editorNote = noteEditor ? caseNotes.find(n => n.key === noteEditor.noteKey && n.tabId === activeCaseId) : undefined;

  const handleSaveNote = (text: string, flag: boolean) => {
    if (!noteEditor) return;
    const { noteKey, nodeLabel, nzbn } = noteEditor;
    setNoteEditor(null);
    if (text.length === 0) {
      // Clearing the text and saving deletes the note.
      if (editorNote) {
        setCaseNotes(prev => prev.filter(n => n.id !== editorNote.id));
        logTrail(`Note deleted · ${nodeLabel}`);
      }
      return;
    }
    if (editorNote) {
      setCaseNotes(prev => prev.map(n => (n.id === editorNote.id ? { ...n, text, flag } : n)));
      logTrail(`Note updated · ${nodeLabel}`);
    } else {
      const note: CaseNote = {
        id: Date.now().toString(),
        key: noteKey,
        tabId: activeCaseId ?? '',
        nodeLabel,
        text,
        flag,
        createdAt: Date.now(),
      };
      setCaseNotes(prev => [...prev, note]);
      logTrail(`Note added · ${nodeLabel}${nzbn ? ` (${nzbn})` : ''}`);
    }
  };

  const handleDeleteNoteFromEditor = () => {
    if (!noteEditor) return;
    const { noteKey, nodeLabel } = noteEditor;
    setNoteEditor(null);
    setCaseNotes(prev => prev.filter(n => !(n.key === noteKey && n.tabId === activeCaseId)));
    logTrail(`Note deleted · ${nodeLabel}`);
  };

  const handleDeleteNote = (noteId: string) => {
    const note = caseNotes.find(n => n.id === noteId);
    setCaseNotes(prev => prev.filter(n => n.id !== noteId));
    if (note) logTrail(`Note deleted · ${note.nodeLabel}`, note.tabId);
  };

  // Sidebar note row click: jump to the note's tab, then highlight the node
  // by key — the same label/nzbn highlight mechanic as handleNodeClick.
  const handleJumpToNote = (note: CaseNote) => {
    if (graphTabs.some(t => t.id === note.tabId)) {
      jumpToTab('company', note.tabId);
    }
    setNodes(nds =>
      nds.map(n => ({
        ...n,
        data: { ...n.data, isHighlighted: (n.data.nzbn || personId(n.data.label)) === note.key },
      }))
    );
  };

  const takeSnapshot = () => {
    if (activeMainTab === 'company' && currentCompanyTab?.graphIncomplete) {
      setNotice('The relationship network is still incomplete. Wait for it to finish before saving a snapshot.');
      return;
    }
    const caseId = activeCaseId;
    const now = Date.now();
    let snapshot: GraphSnapshot;
    if (activeMainTab === 'individual') {
      if (!currentIndividualTab?.personResults.length) return;
      snapshot = { id: crypto.randomUUID(), name: currentIndividualTab.label, dateCreated: now,
        searchType: 'person', searchQuery: currentIndividualTab.searchQuery,
        subjectId: currentIndividualTab.searchQuery, caseId: caseId || undefined,
        nodes: [], edges: [], personResults: currentIndividualTab.personResults,
        disqualifiedMatches: currentIndividualTab.disqualifiedMatches,
        insolvencyMatches: currentIndividualTab.insolvencyMatches, registerChecks: currentIndividualTab.registerChecks };
    } else {
      if (activeMainTab !== 'company' || !allNodesInMemory.length) return;
      const target = allNodesInMemory.find(n => n.data.isTarget) || allNodesInMemory[0];
      snapshot = { id: crypto.randomUUID(), name: target.data.label, dateCreated: now,
        searchType: 'company', searchQuery: currentCompanyTab?.searchQuery || target.data.label,
        subjectId: currentCompanyTab?.nzbn || target.data.nzbn || target.id, caseId: caseId || undefined,
        nodes: allNodesInMemory.map(n => ({ ...n, data: { ...n.data, diff: undefined, isHighlighted: false, isExpanding: false } })), edges: edges as unknown as GraphEdge[],
        viewScope: currentCompanyTab?.viewScope || target.data.companySearchScope,
        hideDirectors: !!currentCompanyTab?.hideDirectors,
        notes: caseNotes.filter(n => n.tabId === caseId) };
    }
    setSnapshotDialog({ name: snapshot.name, snapshot: structuredClone(snapshot), caseId });
  };

  const saveNamedSnapshot = () => {
    if (!snapshotDialog || !snapshotDialog.name.trim()) return;
    const snapshot = { ...snapshotDialog.snapshot, name: snapshotDialog.name.trim() };
    setSnapshots(prev => [snapshot, ...prev]);
    logTrail(`Snapshot saved · "${snapshot.name}"`, snapshotDialog.caseId);
    setNotice(`Snapshot saved: ${snapshot.name}`);
    setSnapshotDialog(null);
  };

  // Restoring opens a separate case; it never overwrites the case currently on screen.
  const loadSnapshot = (snap: GraphSnapshot): string => {
    const tabId = `snapshot-${crypto.randomUUID()}`;
    const openedAt = Date.now();
    const loadedTrail = [{ time: timeLabel(openedAt)!, text: `Snapshot loaded · "${snap.name}"` }];
    activeCaseIdRef.current = tabId;
    setSearchViewOpen(false);
    setSidebarView('case');
    setError(null);
    if (snap.searchType === 'person') {
      const tab: IndividualTab = { id: tabId, label: snap.searchQuery || snap.name,
        searchQuery: snap.searchQuery || snap.name, openedAt, trail: loadedTrail, restoredSnapshotId: snap.id,
        personResults: structuredClone(snap.personResults || []),
        disqualifiedMatches: structuredClone(snap.disqualifiedMatches || []),
        insolvencyMatches: structuredClone(snap.insolvencyMatches || []), registerChecks: snap.registerChecks, isEnriching: false };
      setIndividualTabs(prev => [...prev, tab].slice(-MAX_TABS));
      setActiveIndividualTabId(tabId);
      setSearchMode('person'); setActiveMainTab('individual');
      setPersonSearchResults(tab.personResults); setPersonSearchName(tab.searchQuery);
      setDisqualifiedMatches(tab.disqualifiedMatches); setInsolvencyMatches(tab.insolvencyMatches);
      setNodes([]); setEdges([]); setAllNodesInMemory([]);
    } else {
      const savedNodes = structuredClone(snap.nodes);
      const savedEdges = structuredClone(snap.edges);
      const depthNodes = assignDepths(computePersonRoleFlags(savedNodes, savedEdges), savedEdges);
      const laid = getLayoutedElements(depthNodes.filter(n => n.data.isVisible !== false), savedEdges as unknown as Edge[]);
      const styled = styleEdgesByDepth(laid.edges, nodesToMap(depthNodes));
      const target = depthNodes.find(n => n.data.isTarget) || depthNodes[0];
      const tab: CompanyTab = { id: tabId, label: target?.data.label || snap.name,
        nzbn: target?.data.nzbn || snap.subjectId || '', searchQuery: snap.searchQuery || snap.name,
        openedAt, trail: loadedTrail, restoredSnapshotId: snap.id, nodes: laid.nodes as any, edges: styled as any,
        allNodesInMemory: depthNodes, isLoading: false,
        viewScope: snap.viewScope || target?.data.companySearchScope, hideDirectors: !!snap.hideDirectors };
      setGraphTabs(prev => [...prev, tab].slice(-MAX_TABS));
      setActiveCompanyTabId(tabId); setSearchMode('company'); setActiveMainTab('company');
      setPersonSearchResults([]); setPersonSearchName('');
      setAllNodesInMemory(depthNodes); setNodes(laid.nodes); setEdges(styled);
      if (snap.notes?.length) setCaseNotes(prev => [...prev, ...snap.notes!.map(n =>
        ({ ...n, id: crypto.randomUUID(), tabId }))]);
    }
    return tabId;
  };

  const handleCheckChanges = async (snap: GraphSnapshot) => {
    if (snap.searchType === 'person' || !snap.nodes.length) return;
    const tabId = loadSnapshot(snap);
    setCaseChanges(prev => ({ ...prev, [tabId]: { diffs: null, name: snap.name, checking: true } }));
    logTrail(`Checking ${snap.nodes.filter(n => n.data.type === 'company' && n.data.nzbn).length} entities…`, tabId);
    try {
      const freshNodes = await enrichGraphNodes(structuredClone(snap.nodes), { ...config, includeInactive: true }, handleLog);
      const diffs = diffStatuses(snap.nodes, freshNodes);
      setCaseChanges(prev => ({ ...prev, [tabId]: { diffs, name: snap.name, checking: true } }));
      const diffById = new Map(diffs.map(d => [d.nodeId, d]));
      const stamped = freshNodes.map(n => {
        const d = diffById.get(n.id);
        return d ? { ...n, data: { ...n.data, diff: { prevStatus: d.prevStatus, prevBucket: d.prevBucket } } } : n;
      });
      const depthNodes = assignDepths(stamped, snap.edges);
      const laid = getLayoutedElements(depthNodes.filter(n => n.data.isVisible !== false), snap.edges as unknown as Edge[]);
      const styled = styleEdgesByDepth(laid.edges, nodesToMap(depthNodes));
      setGraphTabs(prev => prev.map(t => t.id === tabId ? { ...t, nodes: laid.nodes as any,
        edges: styled as any, allNodesInMemory: depthNodes } : t));
      if (activeCaseIdRef.current === tabId) {
        setAllNodesInMemory(depthNodes); setNodes(laid.nodes); setEdges(styled);
      }
      logTrail(diffs.length ? `Changes found · ${diffs.length} entities changed since "${snap.name}"` : `No changes since "${snap.name}"`, tabId);
    } catch (err) {
      console.error('Failed to check for changes:', err);
      if (activeCaseIdRef.current === tabId) setError('Failed to check for changes');
      logTrail('Change check failed', tabId);
    } finally { setCaseChanges(prev => ({ ...prev, [tabId]: { ...prev[tabId], checking: false } })); }
  };

  // Changes sidebar row click: highlight the node by key (nodes are already
  // on the canvas — handleCheckChanges just loaded this snapshot).
  const handleJumpToChange = (diff: NodeDiff) => {
    setNodes(nds =>
      nds.map(n => ({
        ...n,
        data: { ...n.data, isHighlighted: (n.data.nzbn || personId(n.data.label)) === diff.key },
      }))
    );
  };

  // Context Menu Handlers
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({
      nodeId: node.id,
      nodeLabel: node.data.label,
      nodeType: node.type || 'companyNode',
      nzbn: node.data.nzbn,
      isCapped: node.data.isCapped,
      sourceRegisterUniqueId: node.data.sourceRegisterUniqueId,
      position: { x: event.clientX, y: event.clientY }
    });
  }, []);

  const handleRecenterGraph = (nodeId: string, nzbn: string, label: string) => {
    setContextMenu(null);

    // Find the clicked node
    const targetNode = nodes.find(n => n.id === nodeId);
    if (!targetNode) return;

    // Mark this node as the new center/target for layout purposes
    const updatedNodes = nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        isTarget: node.id === nodeId // Only the clicked node is marked as target
      }
    }));

    // Re-assign ink-depth relative to the new target, then re-layout
    const depthNodes = assignDepths(updatedNodes as unknown as GraphNode[], edges as unknown as GraphEdge[]);
    const nodesById = nodesToMap(depthNodes);
    const { nodes: relayoutedNodes, edges: relayoutedEdges } = getLayoutedElements(
      depthNodes as unknown as GraphNode[],
      edges
    );

    // Apply the new layout positions
    setNodes(relayoutedNodes);
    setEdges(styleEdgesByDepth(relayoutedEdges, nodesById));

    // Keep memory depths in sync so the case-file stats + node tiers match
    setAllNodesInMemory(prev => {
      if (prev.length === 0) return prev;
      const targetId = depthNodes.find(n => n.data.isTarget)?.id;
      return assignDepths(
        prev.map(n => ({ ...n, data: { ...n.data, isTarget: n.id === targetId } })),
        edges as unknown as GraphEdge[]
      );
    });
  };

  const handleHideParents = (targetNodeId: string) => {
    setContextMenu(null);

    // Find all parent node IDs recursively
    const findAncestors = (nodeId: string, visited = new Set<string>()): Set<string> => {
      if (visited.has(nodeId)) return visited;

      edges
        .filter(e => e.target === nodeId && e.data?.relationshipType === 'parent')
        .forEach(e => {
          visited.add(e.source);
          findAncestors(e.source, visited);
        });

      return visited;
    };

    const allParentIds = findAncestors(targetNodeId);

    // Hide parent nodes by setting opacity
    setNodes((nds) =>
      nds.map(n => ({
        ...n,
        style: {
          ...n.style,
          opacity: allParentIds.has(n.id) ? 0.2 : 1,
          pointerEvents: allParentIds.has(n.id) ? 'none' : 'auto'
        }
      }))
    );

    // Hide parent edges
    setEdges((eds) =>
      eds.map(e => ({
        ...e,
        hidden: allParentIds.has(e.source) || allParentIds.has(e.target)
      }))
    );
  };

  const handleShowAll = () => {
    setContextMenu(null);

    const expanded = allNodesInMemory.map(n => ({...n, data:{...n.data,isVisible:true,isBranchExpanded:true}, style:{...n.style,opacity:1}}));
    setAllNodesInMemory(expanded);
    const laid = getLayoutedElements(expanded, edges.map(e=>({...e,hidden:false})));
    setNodes(laid.nodes);
    setEdges(styleEdgesByDepth(laid.edges, nodesToMap(expanded)));
  };

  const handleShowDirectors = async (nodeId: string, nzbn: string, label: string) => {
    setContextMenu(null);

    try {
      // Use secure proxy
      const proxyPath = `${API_PATHS.nzbn}/entities/${nzbn}`;
      const url = `/api/proxy?path=${encodeURIComponent(proxyPath)}`;

      const response = await fetch(url, {
        headers: {
          'x-user-api-key': config.nzbnKey || '',
          'x-api-type': 'nzbn',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch entity details: ${response.status}`);
      }

      const entityDetails = await response.json();
      console.log('Entity details response:', entityDetails);

      // Extract directors from the roles array
      const roles = entityDetails.roles || [];
      console.log(`Found ${roles.length} total roles`);

      const directors = roles
        .filter((role: any) => {
          // Filter for active directors only
          if (role.endDate) {
            console.log(`Skipping role with endDate: ${role.roleType}`);
            return false;
          }
          const roleType = (role.roleType || '').toLowerCase();
          const roleStatus = (role.roleStatus || '').toLowerCase();
          const isDirector = roleType === 'director';
          const isActive = roleStatus === 'active';

          console.log(`Role: ${role.roleType}, Status: ${role.roleStatus}, IsDirector: ${isDirector}, IsActive: ${isActive}`);
          return isDirector && isActive;
        })
        .map((role: any) => {
          if (role.rolePerson) {
            const fullName = [
              role.rolePerson.firstName,
              role.rolePerson.middleNames,
              role.rolePerson.lastName
            ].filter(Boolean).join(' ');

            return {
              firstName: role.rolePerson.firstName,
              middleName: role.rolePerson.middleNames,
              lastName: role.rolePerson.lastName,
              fullName,
              appointmentDate: role.startDate,
              designation: role.roleType,
              isCorporate: false
            };
          } else if (role.roleEntity) {
            return {
              fullName: role.roleEntity.entityName || 'Unknown Entity',
              appointmentDate: role.startDate,
              designation: role.roleType,
              isCorporate: true
            };
          }
          return null;
        })
        .filter(Boolean);

      console.log(`Found ${directors.length} active directors:`, directors);

      // Calculate smart popup position next to the node
      const node = nodes.find(n => n.id === nzbn);
      let position = { x: 400, y: 200 }; // Default fallback

      if (node) {
        const nodeWidth = 300; // Approximate node width
        const popupWidth = 384; // w-96 = 384px
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Try to position on the right side first
        const rightX = node.position.x + nodeWidth + 20; // 20px gap
        if (rightX + popupWidth < viewportWidth - 200) { // 200px for sidebar
          position = { x: rightX, y: node.position.y };
        }
        // If not enough space on right, try left
        else if (node.position.x - popupWidth - 20 > 200) { // 200px for sidebar
          position = { x: node.position.x - popupWidth - 20, y: node.position.y };
        }
        // If still not enough space horizontally, position below
        else {
          position = { x: node.position.x, y: node.position.y + 150 }; // Below node
        }

        // Ensure popup stays within viewport vertically
        if (position.y + 400 > viewportHeight) { // 400px approximate popup height
          position.y = Math.max(100, viewportHeight - 450);
        }
      }

      // Show director popup
      setDirectorPanel({
        companyName: label,
        position,
        directors
      });

    } catch (err) {
      console.error('Failed to fetch directors:', err);
      setError(`Failed to load directors: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleExpandStructure = async (nodeId: string, nzbn: string, label: string) => {
    const originId = activeCaseIdRef.current;
    setContextMenu(null);

    // Check if this node was capped (mega-node) — needs lazy-load from API
    const memoryNode = allNodesInMemory.find(n => n.id === nodeId);
    if (memoryNode?.data.isCapped) {
      console.log(`🔄 Lazy-loading capped node: ${label} (${nzbn})`);

      // Show expanding spinner on the node
      setNodes(prev => prev.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, isExpanding: true } } : n
      ));

      try {
        const existingNodeIds = allNodesInMemory.map(n => n.id);
        const entityName = memoryNode.data.entityName || label.replace(/^\d+\s*-\s*/, '').trim();

        const result = await expandNodeDownstream(
          nzbn,
          entityName,
          existingNodeIds,
          config,
          handleLog
        );

        // Merge new nodes into memory (skip duplicates)
        const existingIds = new Set(allNodesInMemory.map(n => n.id));
        const newNodes = result.nodes.filter(n => !existingIds.has(n.id));
        // Mark new nodes as visible
        for (const n of newNodes) {
          n.data.isVisible = true;
        }

        // Merge new edges (skip duplicates)
        const existingEdgeIds = new Set(edges.map(e => e.id));
        const newEdges = result.edges.filter(e => !existingEdgeIds.has(e.id));

        console.log(`✅ Lazy-load complete: ${newNodes.length} new nodes, ${newEdges.length} new edges`);

        // Clear capped flag on the expanded node
        const updatedMemory = allNodesInMemory.map(n =>
          n.id === nodeId ? { ...n, data: { ...n.data, isCapped: false, cappedChildCount: undefined, isExpanding: false, isBranchExpanded: true } } : n
        );
        const mergedMemory = [...updatedMemory, ...newNodes];
        const mergedEdges = [...edges, ...newEdges];

        // Recalculate hidden counts, then ink-depth
        const withHiddenCounts = calculateHiddenDescendants(mergedMemory, mergedEdges);
        const depthNodes = assignDepths(computePersonRoleFlags(withHiddenCounts, mergedEdges as unknown as GraphEdge[]), mergedEdges as unknown as GraphEdge[]);
        const nodesById = nodesToMap(depthNodes);



        // Filter visible nodes and re-layout
        const visibleNodes = depthNodes.filter(n => n.data.isVisible);
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
          visibleNodes,
          mergedEdges as unknown as Edge[]
        );

        const styledEdges = styleEdgesByDepth(layoutedEdges, nodesById);
        setGraphTabs(prev => prev.map(t => t.id === originId ? { ...t, allNodesInMemory: depthNodes,
          nodes: layoutedNodes as any, edges: styledEdges as any } : t));
        if (activeCaseIdRef.current === originId) {
          setAllNodesInMemory(depthNodes); setNodes(layoutedNodes); setEdges(styledEdges);
        }
        if (newNodes.length > 0) logTrail(`Expanded ${label} · +${newNodes.length} ${newNodes.length === 1 ? 'entity' : 'entities'}`, originId);
      } catch (err) {
        console.error('Failed to lazy-load node:', err);
        if (activeCaseIdRef.current === originId) setError(`Failed to expand structure: ${err instanceof Error ? err.message : 'Unknown error'}`);
        // Clear spinner
        if (activeCaseIdRef.current === originId) setNodes(prev => prev.map(n =>
          n.id === nodeId ? { ...n, data: { ...n.data, isExpanding: false } } : n
        ));
      }
      return;
    }

    // Standard expand: reveal already-in-memory hidden nodes
    console.log('🚀 EXPANDING:', { nodeId, nzbn, label });

    const prevVisible = allNodesInMemory.filter(n => n.data.isVisible).length;

    // Expand the subtree in memory
    let expandedNodes = expandNodeSubtree(allNodesInMemory, edges, nodeId);

    // Recalculate hidden counts after expansion, then ink-depth
    expandedNodes = calculateHiddenDescendants(expandedNodes, edges);
    const depthNodes = assignDepths(expandedNodes, edges as unknown as GraphEdge[]);
    const nodesById = nodesToMap(depthNodes);

    // Update memory
    setAllNodesInMemory(depthNodes);

    // Filter visible nodes and re-layout
    const visibleNodes = depthNodes.filter(n => n.data.isVisible);
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      visibleNodes,
      edges
    );

    setNodes(layoutedNodes);
    setEdges(styleEdgesByDepth(layoutedEdges, nodesById));
    const added = visibleNodes.length - prevVisible;
    if (added > 0) logTrail(`Expanded ${label} · +${added} ${added === 1 ? 'entity' : 'entities'}`);
  };

  const handleCollapseBranch = (nodeId: string, nzbn: string, label: string) => {
    setContextMenu(null);

    // Collapse the subtree in memory
    let collapsedNodes = collapseNodeSubtree(allNodesInMemory, edges, nodeId);

    // Recalculate hidden counts after collapse, then ink-depth
    collapsedNodes = calculateHiddenDescendants(collapsedNodes, edges);
    const depthNodes = assignDepths(collapsedNodes, edges as unknown as GraphEdge[]);
    const nodesById = nodesToMap(depthNodes);

    // Update memory
    setAllNodesInMemory(depthNodes);

    // Filter visible nodes and re-layout
    const visibleNodes = depthNodes.filter(n => n.data.isVisible);
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      visibleNodes,
      edges
    );

    setNodes(layoutedNodes);
    setEdges(styleEdgesByDepth(layoutedEdges, nodesById));
  };

  // Tidy Up Layout Handler
  const handleTidyUp = () => {
    if (nodes.length === 0) return;

    console.log('🎨 Tidy Up button clicked');

    // Store original layout before optimization
    setOriginalLayout({
      nodes: nodes.map(n => ({ ...n, position: { ...n.position } })),
      edges: edges
    });

    // Apply optimization
    const optimized = tidyUpLayout(nodes, edges);
    setNodes(optimized.nodes);
    setEdges(optimized.edges);
  };

  // Undo Tidy Up Handler
  const handleUndoTidyUp = () => {
    if (!originalLayout) return;

    console.log('⏪ Undoing Tidy Up');
    setNodes(originalLayout.nodes);
    setEdges(originalLayout.edges);
    setOriginalLayout(null);
  };



  // Decoration pass: stamp hasNote/noteFlagged onto NodeData from caseNotes,
  // keyed by nzbn ?? personId(label) (the one person-identity normalization).
  // No consumer yet — Stage B's CustomNodes dog-ear renders these. Kept cheap:
  // identity when there are no notes, untouched node objects when unannotated.
  // Role filter (left panel) — view-only, never persisted.
  //
  // Directors only, deliberately. A "hide shareholders" companion was built and
  // removed: it appeared to work on the searched company and do nothing further
  // out, which is not a bug in the filter but in what there is to filter —
  // individual shareholders are only ever parsed by crawlUpstream (the root and
  // its parents). crawlDownstream never creates a person node for a subsidiary's
  // shareholders, so there was nothing out there to hide. A control that behaves
  // differently depending on where you look is worse than no control, and hiding
  // directors is what makes the corporate structure readable anyway.
  const hideDirectors = !!currentCompanyTab?.hideDirectors;
  const setHideDirectors = (next: boolean | ((previous: boolean) => boolean)) => {
    const id = activeCaseIdRef.current;
    setGraphTabs(prev => prev.map(t => t.id === id ? { ...t,
      hideDirectors: typeof next === 'function' ? next(!!t.hideDirectors) : next } : t));
  };
  // Two more render-time filters over the same crawl (nothing refetched): hide
  // struck-off/dissolved companies, and hide resigned (ceased) directorships.
  const hideInactiveCompanies = currentCompanyTab?.hideInactiveCompanies !== false;
  const setHideInactiveCompanies = (next: boolean | ((previous: boolean) => boolean)) => {
    const id = activeCaseIdRef.current;
    setGraphTabs(prev => prev.map(t => t.id === id ? { ...t,
      hideInactiveCompanies: typeof next === 'function' ? next(t.hideInactiveCompanies !== false) : next } : t));
  };
  const hideInactiveDirectors = currentCompanyTab?.hideInactiveDirectors !== false;
  const setHideInactiveDirectors = (next: boolean | ((previous: boolean) => boolean)) => {
    const id = activeCaseIdRef.current;
    setGraphTabs(prev => prev.map(t => t.id === id ? { ...t,
      hideInactiveDirectors: typeof next === 'function' ? next(t.hideInactiveDirectors !== false) : next } : t));
  };
  const graphScope = currentCompanyTab?.viewScope || allNodesInMemory.find(n => n.data.isTarget)?.data.companySearchScope;
  const scopeGraph = useMemo(() => {
    const target = allNodesInMemory.find(n => n.data.isTarget) || allNodesInMemory[0];
    if (graphScope === 'simple' && target) {
      const immediate = immediateCompanyGraph(allNodesInMemory, edges as unknown as GraphEdge[], target.id);
      const liveById = new Map(nodes.map(n => [n.id, n]));
      // Preserve React Flow measurements when deriving the immediate view.
      const measured = immediate.nodes.map(n => ({ ...liveById.get(n.id), ...n }));
      const depthNodes = assignDepths(measured, immediate.edges);
      const laid = getLayoutedElements(depthNodes, immediate.edges as unknown as Edge[]);
      return { nodes: laid.nodes, edges: styleEdgesByDepth(laid.edges, nodesToMap(depthNodes)) };
    }
    return { nodes, edges };
  }, [nodes, edges, allNodesInMemory, graphScope]);

  const nodesWithAnnotations = useMemo(() => {
    const notes = caseNotes.filter(n => n.tabId === activeCaseId);
    const flagByKey = new Map(notes.map(n => [n.key, n.flag]));
    return scopeGraph.nodes.map(n => {
      const data = n.data as unknown as NodeData;
      const key = data.nzbn || personId(data.label);
      return { ...n, data: { ...data, hasNote: flagByKey.has(key), noteFlagged: !!flagByKey.get(key) } as any };
    });
  }, [scopeGraph.nodes, caseNotes, activeCaseId]);
  // A struck-off / dissolved / amalgamated company — the "dead entity" buckets.
  // Liquidation and insolvency are NOT inactive: they stay on the chart as live
  // red flags.
  const isRemovedCompany = (d: NodeData) =>
    d.type === NodeType.COMPANY && removedCompany(d);
  // A ceased directorship edge — a resigned director's tie to a company.
  const isCeasedDirectorEdge = (e: { data?: any }) =>
    !!(e.data?.isCeased || e.data?.currentUnverified);

  const visible = useMemo(() => {
    // 1. Node-level: drop director-only people and/or removed companies.
    const keptNodes = nodesWithAnnotations.filter(n => {
      const d = n.data as unknown as NodeData;
      if (hideDirectors && d.roleKind === 'director') return false;
      if ((graphScope === 'simple' || hideInactiveCompanies) && isRemovedCompany(d)) return false;
      return true;
    });
    const keptIds = new Set(keptNodes.map(n => n.id));
    // 2. Edge-level: only between kept nodes; drop ceased directorships too.
    let edges = scopeGraph.edges.filter(e => keptIds.has(e.source) && keptIds.has(e.target));
    if (hideInactiveDirectors) edges = edges.filter(e => !isCeasedDirectorEdge(e));
    // 3. Drop people the edge removal orphaned (a resigned director with no live
    //    tie left); anyone still an active director or shareholder keeps an edge.
    const connected = new Set<string>();
    edges.forEach(e => { connected.add(e.source); connected.add(e.target); });
    const nodes = keptNodes.filter(n =>
      (n.data as unknown as NodeData).isTarget || connected.has(n.id));
    const finalIds = new Set(nodes.map(n => n.id));
    return { nodes, edges: edges.filter(e => finalIds.has(e.source) && finalIds.has(e.target)) };
  }, [nodesWithAnnotations, scopeGraph.edges, hideDirectors, hideInactiveCompanies, hideInactiveDirectors, graphScope]);
  const visibleNodes = visible.nodes;
  const visibleEdges = visible.edges;

  const hideableDirectors = scopeGraph.nodes.filter(n => (n.data as unknown as NodeData).roleKind === 'director').length;
  const inactiveCompanyCount = useMemo(() =>
    scopeGraph.nodes.filter(n => isRemovedCompany(n.data as unknown as NodeData)).length, [scopeGraph.nodes]);
  // People whose only ties are ceased directorships — the ones "hide inactive
  // directors" would remove.
  const inactiveDirectorCount = useMemo(() => {
    return scopeGraph.edges.filter(isCeasedDirectorEdge).length;
  }, [scopeGraph.nodes, scopeGraph.edges]);

  // Case-file derived values
  useEffect(() => {
    setEntityDetailsNzbn(null); setNoteEditor(null); setContextMenu(null); setDirectorPanel(null);
  }, [activeCaseId, activeMainTab, searchViewOpen]);
  const graphLoaded = allNodesInMemory.length > 0;
  const caseTarget = allNodesInMemory.find(n => n.data.isTarget) || allNodesInMemory[0];
  const caseDepth = allNodesInMemory.reduce((m, n) => Math.max(m, n.data.depth ?? 0), 0);
  const caseAlerts = (graphScope === 'simple' ? scopeGraph.nodes : allNodesInMemory).flatMap(n => {
    const alerts = entityStatus(n.data).alerts;
    return alerts.length ? [{ label: `${n.data.label} · ${alerts.map(a => a.label).join('; ')}`,
      historical: alerts.every(a => a.historical), tone: entityStatus(n.data).tone }] : [];
  });
  const caseFlags = caseAlerts.length;
  const caseOpened = timeLabel(currentCompanyTab?.openedAt) || trail[0]?.time;

  // Individual case-file derived values
  const personActiveCount = personSearchResults.filter(r => !r.isInactive).length;
  const personAlerts = personSearchResults.flatMap(r => {
    const alerts = entityStatus(r as any).alerts;
    return alerts.length ? [{ label: `${r.companyName} · ${alerts.map(a => a.label).join('; ')}`,
      historical: alerts.every(a => a.historical), tone: entityStatus(r as any).tone }] : [];
  });
  if (disqualifiedMatches.length) personAlerts.push({ label: `${disqualifiedMatches.length} disqualified director register match(es) · verify identity`, historical: false, tone: 'critical' });
  if (insolvencyMatches.length) personAlerts.push({ label: `${insolvencyMatches.length} insolvency register match(es) · verify identity`, historical: false, tone: 'critical' });
  const personFlagsCount = personAlerts.length;
  const scopedSnapshots = activeMainTab === 'property' ? [] : snapshots.filter(s => s.caseId === activeCaseId ||
    s.id === (activeMainTab === 'company' ? currentCompanyTab?.restoredSnapshotId : currentIndividualTab?.restoredSnapshotId) ||
    (!s.caseId && ((activeMainTab === 'company' && (s.subjectId === currentCompanyTab?.nzbn ||
      s.nodes?.some(n => n.data.isTarget && n.data.nzbn === currentCompanyTab?.nzbn))) ||
      (activeMainTab === 'individual' && s.searchType === 'person' && s.searchQuery === currentIndividualTab?.searchQuery))));


  return (
    <div className="h-screen w-screen flex flex-col bg-paper">
      {showIntro && (
        <IntroAnimation
          onComplete={() => {
            try { sessionStorage.setItem(INTRO_SEEN_KEY, '1'); } catch { /* private mode */ }
            setShowIntro(false);
          }}
        />
      )}
      <ConfigBar
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <main className="flex-1 flex mt-[52px] relative overflow-hidden">
        {/* Sidebar collapse expander (floating) */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={`absolute top-1/2 -translate-y-1/2 z-50 p-1.5 bg-paper border border-rule text-ink-mid hover:text-ink hover:border-ink-mid ${isResizingSidebar ? '' : 'transition-all'} ${
            isMobile
              ? (isSidebarCollapsed ? 'left-2' : 'hidden')
              : (isSidebarCollapsed ? 'left-2' : '')
            }`}
          style={!isMobile && !isSidebarCollapsed ? { left: sidebarWidth } : undefined}
          aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isSidebarCollapsed ? <ChevronRight size={16} strokeWidth={1.5} /> : <ChevronLeft size={16} strokeWidth={1.5} />}
        </button>

        {/* Drag handle to resize the sidebar */}
        {!isMobile && !isSidebarCollapsed && (
          <div
            onMouseDown={startSidebarResize}
            className="absolute top-0 bottom-0 z-40 w-1 -ml-0.5 cursor-col-resize hover:bg-accent/40"
            style={{ left: sidebarWidth }}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
          />
        )}

        {/* Mobile backdrop - tap outside to close sidebar */}
        {isMobile && !isSidebarCollapsed && (
          <div
            className="absolute inset-0 z-30 bg-black/40"
            onClick={() => setIsSidebarCollapsed(true)}
          />
        )}

        {/* Left column: icon rail + case-file / search panel */}
        <div
          className={`flex bg-paper overflow-hidden ${
            isMobile
              ? `absolute inset-y-0 left-0 z-40 transition-transform duration-300 ease-in-out ${isSidebarCollapsed ? '-translate-x-full' : 'translate-x-0'}`
              : `relative z-20 ${isResizingSidebar ? '' : 'transition-[width] duration-300 ease-in-out'}`
          }`}
          style={{ width: isMobile ? 334 : (isSidebarCollapsed ? 0 : sidebarWidth) }}
        >

          {/* Icon rail */}
          <nav className="w-16 flex-shrink-0 border-r border-rule bg-paper flex flex-col items-center py-3.5 gap-1.5" aria-label="Primary">
            <button
              onClick={openSearchView}
              className={`relative w-10 h-10 grid place-items-center transition-colors ${searchViewOpen ? 'text-ink' : 'text-ink-mid hover:text-ink'}`}
              aria-label="Search"
              title="Search"
            >
              {searchViewOpen && <span className="absolute left-[-12px] top-2 bottom-2 w-0.5 bg-accent" />}
              <Search size={17} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => { closeSearchView(); setSidebarView('case'); }}
              className={`relative w-10 h-10 grid place-items-center transition-colors ${!searchViewOpen && sidebarView === 'case' ? 'text-ink' : 'text-ink-mid hover:text-ink'}`}
              aria-label="Case"
              title="Case"
            >
              {!searchViewOpen && sidebarView === 'case' && <span className="absolute left-[-12px] top-2 bottom-2 w-0.5 bg-accent" />}
              <FolderOpen size={17} strokeWidth={1.5} />
            </button>
            <button onClick={() => { closeSearchView(); setSidebarView('workspace'); }}
              className={`relative w-10 h-10 grid place-items-center transition-colors ${!searchViewOpen && sidebarView === 'workspace' ? 'text-ink' : 'text-ink-mid hover:text-ink'}`}
              aria-label="Workspace" title="Workspace">
              {!searchViewOpen && sidebarView === 'workspace' && <span className="absolute left-[-12px] top-2 bottom-2 w-0.5 bg-accent" />}
              <Layers size={17} strokeWidth={1.5} />
            </button>
            <span className="flex-1" />
          </nav>

          {/* Cases dossier panel */}
          <CasePanel key={`${activeCaseId}-${sidebarView}`}
            view={sidebarView}
            onOpenWorkspaceCase={(id, type) => jumpToTab(type || 'company', id)}
            workspaceCases={[...graphTabs.map(t => ({ id: t.id, label: t.label, type: 'company' as const })),
              ...individualTabs.map(t => ({ id: t.id, label: t.label, type: 'individual' as const })),
              ...propertyTabs.map(t => ({ id: t.id, label: t.label, type: 'property' as const }))]}
            activeMainTab={activeMainTab}
            graphLoaded={graphLoaded}
            caseTarget={caseTarget}
            entityCount={scopeGraph.nodes.length}
            caseDepth={caseDepth}
            caseFlags={caseFlags}
            caseAlerts={caseAlerts}
            personAlerts={personAlerts}
            caseOpened={caseOpened}
            personSearchName={displaySubjectName(personSearchName, personSearchResults)}
            personResultsCount={personSearchResults.length}
            personActiveCount={personActiveCount}
            personFlagsCount={personFlagsCount}
            personSearchOpened={personSearchOpened}
            hideDirectors={hideDirectors}
            onToggleHideDirectors={() => setHideDirectors(v => !v)}
            hideableDirectors={hideableDirectors}
            showHistoryControls={graphScope !== 'simple'}
            hideInactiveCompanies={hideInactiveCompanies}
            onToggleHideInactiveCompanies={() => setHideInactiveCompanies(v => !v)}
            inactiveCompanyCount={inactiveCompanyCount}
            hideInactiveDirectors={hideInactiveDirectors}
            onToggleHideInactiveDirectors={() => setHideInactiveDirectors(v => !v)}
            inactiveDirectorCount={inactiveDirectorCount}
            trail={trail}
            caseNotes={caseNotes.filter(n => n.tabId === activeCaseId)}
            workspaceNotes={caseNotes}
            noteTabLabels={Object.fromEntries(graphTabs.map(t => [t.id, t.label]))}
            onDeleteNote={handleDeleteNote}
            onJumpToNote={handleJumpToNote}
            companyTabs={graphTabs.filter(t => t.id === activeCaseId)}
            individualTabs={individualTabs.filter(t => t.id === activeCaseId)}
            workspaceCompanyTabs={graphTabs}
            workspaceIndividualTabs={individualTabs}
            onJumpToPerson={(person, app) => {
              // Same jump + highlight-by-key mechanic as handleJumpToNote.
              jumpToTab(app.kind === 'person-tab' ? 'individual' : 'company', app.tabId);
              if (app.kind === 'graph-node') {
                setNodes(nds => nds.map(n => ({
                  ...n,
                  data: { ...n.data, isHighlighted: !n.data.nzbn && personId(n.data.label) === person.key },
                })));
              }
            }}
            nodeDiffs={nodeDiffs}
            lastCheckedSavePointName={lastCheckedSavePointName}
            isCheckingChanges={isCheckingChanges}
            onJumpToChange={handleJumpToChange}
            savePoints={scopedSnapshots}
            workspaceSavePoints={snapshots}
            onLoadSavePoint={loadSnapshot}
            onDeleteSavePoint={deleteSnapshot}
            onExportSavePoint={exportSnapshot}
            onExportAllSavePoints={exportAllSnapshots}
            onTakeSavePoint={takeSnapshot}
            onImportSavePoint={handleImportSnapshot}
            onCheckChanges={handleCheckChanges}
            onExportHtml={exportAsHtml}
            isExportingHtml={isExportingHtml}
            canExport={activeMainTab === 'company' ? graphLoaded && !currentCompanyTab?.graphIncomplete : activeMainTab === 'individual' && personSearchResults.length > 0}
          />
        </div>

        {/* Graph Area */}
        <div className="flex-1 flex flex-col h-full bg-paper relative">
          {/* Also covers the person search (isLoading), which "Search as Individual"
              fires from the graph view. That path used to give NO feedback at all:
              a 40-directorship subject takes tens of seconds to come back, so the
              click read as a dead button. Excluded while the find screen is open,
              which has its own inline spinner for search-as-you-type. */}
          {!searchViewOpen && ((activeMainTab === 'company' && currentCompanyTab?.isLoading && nodes.length === 0) || (activeMainTab === 'individual' && currentIndividualTab?.isEnriching)) && (
            <div className="absolute top-0 left-0 right-0 z-50">
              <div className="h-0.5 bg-paper2 overflow-hidden relative">
                <div className="loadsweep absolute inset-y-0 left-0 w-1/3 bg-accent" />
              </div>
              <div className="bg-paper border-b border-rule py-1.5 text-center text-ink-mid" style={{ fontSize: 12 }}>
                {activeMainTab === 'company' ? 'Mapping corporate structure…' : 'Searching registers…'}
              </div>
            </div>
          )}

          {/* Tab Bar */}
          <TabBar
            activeMainTab={activeMainTab}
            onMainTabChange={handleMainTabChange}
            companyTabs={graphTabs.map(t => ({ id: t.id, label: t.label, isLoading: t.isLoading }))}
            individualTabs={individualTabs.map(t => ({ id: t.id, label: t.label, isLoading: t.isEnriching }))}
            propertyTabs={propertyTabs.map(t => ({ id: t.id, label: t.label, title: `${t.label} · Title ${t.titleNo}` }))}
            activeSubTabId={
              activeMainTab === 'company' ? activeCompanyTabId
              : activeMainTab === 'individual' ? activeIndividualTabId
              : activePropertyTabId
            }
            onSubTabClick={handleSubTabClick}
            onSubTabClose={handleSubTabClose}
            searchViewOpen={searchViewOpen}
            onNewSearch={openSearchView}
          />

          {!searchViewOpen && activeMainTab === 'company' && nodes.length > 0 && <RegisterCheckProgress
            nodes={allNodesInMemory} phase={searchPhases[activeCompanyTabId || 'current']} />}
          <div className="flex-1 relative">
            {/* A property report owns the canvas whenever its tab is active — it
                is a document, not a graph, so it scrolls in place. */}
            {!searchViewOpen && activeMainTab === 'property' && activePropertyTab ? (
              <div className="absolute inset-0 overflow-y-auto bg-paper">
                <PropertyReport
                  key={activePropertyTab.id}
                  report={activePropertyTab.report as PropertyTitleReport}
                  onBack={openSearchView}
                  onExport={() => exportPropertyReport(activePropertyTab)}
                  isExporting={isExportingHtml}
                />
              </div>
            ) : searchViewOpen || (nodes.length === 0 && !isGraphLoading && !(activeMainTab === 'individual' && (personSearchResults.length > 0 || disqualifiedMatches.length > 0 || insolvencyMatches.length > 0 || currentIndividualTab?.isEnriching))) ? (
              <div className="absolute inset-0">
                <FindScreen
                  key={searchViewNonce}
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                  onSearchSubmit={() => handleSearch({ preventDefault: () => {} } as React.FormEvent)}
                  results={searchResults}
                  onResultSelect={handleSelectEntityInTab}
                  isLoading={isLoading}
                  searchMode={searchMode}
                  companySearchScope={companySearchScope}
                  onCompanySearchScopeChange={setCompanySearchScope}
                  onSearchModeChange={(m) => {
                    setSearchMode(m);
                    setActiveMainTab(m === 'person' ? 'individual' : 'company');
                    setSearchResults([]);
                    setError(null);
                  }}
                  onCompare={handleCompare}
                  onCompareCancel={handleCompareCancel}
                  compareProgress={compareProgress}
                  compareNoLink={compareNoLink}
                  onCompareReset={() => setCompareNoLink(null)}
                  fetchCompanySuggestions={fetchCompareSuggestions}
                  startOnProperty={activeMainTab === 'property'}
                  onPropertyFaceChange={(on) => {
                    // Keep the tab bar in step with the mode line: entering 地
                    // makes Property the active mode, leaving it hands back to
                    // whichever of Companies/People the search is on.
                    if (on) setActiveMainTab('property');
                    else setActiveMainTab(searchMode === 'person' ? 'individual' : 'company');
                  }}
                  onOpenPropertyReport={handleOpenPropertyReport}
                />
              </div>
            ) : activeMainTab === 'individual' && (personSearchResults.length > 0 || disqualifiedMatches.length > 0 || insolvencyMatches.length > 0) ? (
              <PersonSearchResults
                personName={personSearchName}
                results={personSearchResults}
                disqualifiedDirectors={disqualifiedMatches}
                insolvencyRecords={insolvencyMatches}
                registerChecks={currentIndividualTab?.registerChecks}
                onCompanyClick={handleCompanyCardClick}
                onBack={() => {
                  setPersonSearchResults([]);
                  setDisqualifiedMatches([]);
                  setInsolvencyMatches([]);
                  setPersonSearchName('');
                  setSearchQuery('');
                }}
              />
            ) : entityDetailsNzbn ? (
              <EntityDetailsPanel key={entityDetailsNzbn} nzbn={entityDetailsNzbn} statusContext={allNodesInMemory.find(n => n.data.nzbn === entityDetailsNzbn)?.data} config={config} onClose={() => setEntityDetailsNzbn(null)} />
            ) : (
              <div className="absolute inset-0 flex min-h-0 flex-col bg-paper">
                {caseTarget?.data.nzbn && <div className="sumi-graph-tools">
                  {caseTarget.data.companySearchScope ? <GraphScopeControl key={activeCompanyTabId}
                    scope={graphScope || caseTarget.data.companySearchScope} name={caseTarget.data.label} busy={!!currentCompanyTab?.isLoading}
                    comprehensiveAvailable={caseTarget.data.companySearchScope === 'comprehensive'}
                    onShowSimple={() => setGraphTabs(prev => prev.map(t => t.id === activeCompanyTabId ? { ...t, viewScope: 'simple' } : t))}
                    onShowComprehensive={() => setGraphTabs(prev => prev.map(t => t.id === activeCompanyTabId ? { ...t, viewScope: 'comprehensive' } : t))}
                    onRun={async () => {
                      const entity = { nzbn: caseTarget.data.nzbn!, entityName: caseTarget.data.label,
                        entityStatusDescription: caseTarget.data.status || '', entityTypeCode: caseTarget.data.entityTypeCode || '' };
                      await handleSelectEntity(entity, activeCompanyTabId || undefined, 'comprehensive');
                    }} /> : <span />}
                  <div className="sumi-view-switch" role="group" aria-label="Entity view">
                    <span aria-current="page"><span aria-hidden="true">網</span> Org Chart</span>
                    <button aria-label="Details" onClick={() => setEntityDetailsNzbn(caseTarget.data.nzbn!)}><span aria-hidden="true">簿</span> Details</button>
                  </div>
                </div>}
                <div className="relative min-h-0 flex-1">
                <ReactFlow
                key={`${activeCompanyTabId}-${searchPhases[activeCompanyTabId || 'current'] === 'mapping' ? 'preview' : 'full'}`}
                nodes={visibleNodes}
                edges={visibleEdges}
                nodesDraggable={searchPhases[activeCompanyTabId || 'current'] !== 'mapping'}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                onNodeContextMenu={searchPhases[activeCompanyTabId || 'current'] === 'mapping' ? undefined : handleNodeContextMenu}
                onPaneClick={handlePaneClick}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.18 }}
                className="bg-paper"
                minZoom={0.1}
              >
                {/* No dot grid — the sumi canvas is plain washi paper (bg-paper
                    on the pane), with the washi grain overlay from index.css. */}
                <Controls />
                {/* Tidy Up controls — styled to match the mockup .replay button
                    (1px rule border, paper bg, ~12px, ink-mid text, hover to ink). */}
                {nodes.length > 0 && (
                  <Panel position="bottom-left" className="mb-2 ml-2">
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={handleTidyUp}
                        className="bg-paper border border-rule text-ink-mid hover:text-ink hover:border-ink-mid transition-colors flex items-center gap-2"
                        style={{ fontSize: 12, padding: '7px 13px' }}
                        title="Optimize layout into compact pyramid shape"
                      >
                        <Sparkles size={15} strokeWidth={1.5} className="text-accent" />
                        <span>Tidy Up</span>
                      </button>

                      {originalLayout && (
                        <button
                          onClick={handleUndoTidyUp}
                          className="bg-paper border border-rule text-ink-mid hover:text-ink hover:border-ink-mid transition-colors flex items-center gap-2"
                          style={{ fontSize: 12, padding: '7px 13px' }}
                          title="Revert to original layout"
                        >
                          <Undo size={15} strokeWidth={1.5} className="text-amber" />
                          <span>Undo</span>
                        </button>
                      )}
                    </div>
                  </Panel>
                )}

                {/* Ink-depth + status-ramp legend — bottom-right. */}
                {nodes.length > 0 && (
                  <Panel position="bottom-right" className="mb-2 mr-2">
                    <StatusLegend />
                  </Panel>
                )}
                </ReactFlow>
                </div>
              </div>
            )}

            {/* Error banner (search / graph failures surface here now the panel search is gone) */}
            {error && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-paper border border-crit px-3 py-2 flex gap-2 items-start max-w-md">
                <AlertTriangle className="text-crit shrink-0 mt-0.5" size={14} strokeWidth={1.5} />
                <p className="text-crit leading-tight" style={{ fontSize: 12 }}>{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-ink-pale hover:text-ink flex-shrink-0"
                  aria-label="Dismiss error"
                >
                  <X size={12} strokeWidth={1.5} />
                </button>
              </div>
            )}

            {/* Context Menu */}
            {contextMenu && (
              <NodeContextMenu
                onEntityDetails={setEntityDetailsNzbn}
                sourceRegister={allNodesInMemory.find(n => n.id === contextMenu.nodeId)?.data.sourceRegister}
                simpleSearch={graphScope === 'simple'}
                nodeId={contextMenu.nodeId}
                nodeLabel={contextMenu.nodeLabel}
                nodeType={contextMenu.nodeType}
                nzbn={contextMenu.nzbn}
                isCapped={contextMenu.isCapped}
                sourceRegisterUniqueId={contextMenu.sourceRegisterUniqueId}
                position={contextMenu.position}
                onClose={() => setContextMenu(null)}
                onRecenter={handleRecenterGraph}
                onHideParents={handleHideParents}
                onShowAll={handleShowAll}
                onShowDirectors={handleShowDirectors}
                onExpandStructure={handleExpandStructure}
                onCollapseBranch={handleCollapseBranch}
                onSearchPerson={(name: string) => {
                  setContextMenu(null);
                  setSearchMode('person');
                  setSearchQuery(name); // keep the search box in step, as the director-panel path does
                  handlePersonSearch(name);
                }}
                onAddNote={openNoteEditor}
              />
            )}

            {/* Note Editor (Stage B) — takes over the context menu's position */}
            {noteEditor && (
              <NoteEditor
                nodeLabel={noteEditor.nodeLabel}
                nzbn={noteEditor.nzbn}
                position={noteEditor.position}
                initialText={editorNote?.text ?? ''}
                initialFlag={editorNote?.flag ?? false}
                hasExisting={!!editorNote}
                onSave={handleSaveNote}
                onDelete={handleDeleteNoteFromEditor}
                onCancel={() => setNoteEditor(null)}
              />
            )}

            {/* Director Panel */}
            {directorPanel && (
              <DirectorPanel
                companyName={directorPanel.companyName}
                position={directorPanel.position}
                directors={directorPanel.directors}
                onClose={() => setDirectorPanel(null)}
                onSearchPerson={(name: string) => {
                  setDirectorPanel(null);
                  setSearchMode('person');
                  setSearchQuery(name);
                  handlePersonSearch(name);
                }}
              />
            )}


            {/* Confirmation Dialog */}
            {confirmChartLoad && (
              <ConfirmOrgChartDialog
                companyName={confirmChartLoad.companyName}
                onConfirm={handleConfirmLoadChart}
                onCancel={() => setConfirmChartLoad(null)}
              />
            )}

          </div>

        </div>
      </main>

      {/* Command palette (Ctrl/Cmd+K) */}
      {snapshotDialog && <SnapshotNameDialog name={snapshotDialog.name}
        onChange={name => setSnapshotDialog(prev => prev ? { ...prev, name } : null)}
        onSave={saveNamedSnapshot} onCancel={() => setSnapshotDialog(null)} />}
      {notice && <div role="status" className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] max-w-[90vw] bg-ink text-paper border border-rule px-5 py-3 shadow-lg" style={{ fontSize: 13 }}>{notice}</div>}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        getCommands={buildPaletteCommands}
      />

      <Analytics />
    </div>
  );
}

export default App;
