import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Panel,
} from 'reactflow';
import { Search, Camera, AlertTriangle, Loader2, MousePointer2, Building2, X, Database, ChevronRight, ChevronLeft, Terminal, Activity, Trash2, Download, FileDown, Sparkles, Undo, User, Upload } from 'lucide-react';
import { ConfigBar } from './components/ConfigBar';
import { CompanyNode, PersonNode, SummaryNode } from './components/CustomNodes';
import { NodeContextMenu } from './components/NodeContextMenu';
import { DirectorPanel } from './components/DirectorPanel';
import { PersonSearchResults } from './components/PersonSearchResults';
import { ConfirmOrgChartDialog } from './components/ConfirmOrgChartDialog';
import { TabBar } from './components/TabBar';
import { enrichCompanyResults, enrichGraphNodes } from './src/api/companyStatusApi';
import { markDirectLineage, calculateHiddenDescendants, expandNodeSubtree, collapseNodeSubtree } from './utils/graphVisibility';
import { getLayoutedElements } from './services/layoutService';
import { tidyUpLayout } from './services/layoutOptimizer';
import { generateOrgChart, searchEntities } from './services/apiService';
import { extractDirectorsFromEntity } from './services/directorService';
import { ApiConfig, EntitySearchResultItem, GraphSnapshot, GraphNode, GraphEdge, LogEntry, NodeType, NZBNFullEntity, PersonCompanyResult, CompanyTab, IndividualTab } from './types';
import { searchByPersonName } from './services/directorSearchService';
import { searchDisqualifiedDirectors, DisqualifiedDirector } from './src/api/disqualifiedDirectorsApi';
import { searchInsolvency, InsolvencyRecord } from './src/api/insolvencyApi';
import { BASE_API_URL, API_PATHS } from './constants';


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

function App() {
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
    localStorage.setItem('mitsuketa_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // App State
  const [config, setConfig] = useState<ApiConfig>(() => {
    const saved = localStorage.getItem('mitsuketa_config');
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EntitySearchResultItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<GraphEdge>([]);
  const [allNodesInMemory, setAllNodesInMemory] = useState<GraphNode[]>([]); // Full graph stored here
  const [snapshots, setSnapshots] = useState<GraphSnapshot[]>(() => {
    const saved = localStorage.getItem('mitsuketa_snapshots');
    return saved ? JSON.parse(saved) : [];
  });

  // Diagnostic State
  const [showInspector, setShowInspector] = useState(false);
  const [debugData, setDebugData] = useState<{
    upstream: any;
    downstream: any;
    audit: any;
    upstreamMsg?: string;
    downstreamMsg?: string;
  }>({ upstream: null, downstream: null, audit: null });

  // Network Console State
  const [apiLogs, setApiLogs] = useState<LogEntry[]>([]);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [showInactiveWarning, setShowInactiveWarning] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    nodeId: string;
    nodeLabel: string;
    nodeType: string;
    nzbn?: string;
    sourceRegisterUniqueId?: string;
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
  const [personSearchResults, setPersonSearchResults] = useState<PersonCompanyResult[]>([]);
  const [personSearchName, setPersonSearchName] = useState('');
  const [disqualifiedMatches, setDisqualifiedMatches] = useState<DisqualifiedDirector[]>([]);
  const [insolvencyMatches, setInsolvencyMatches] = useState<InsolvencyRecord[]>([]);
  const [confirmChartLoad, setConfirmChartLoad] = useState<PersonCompanyResult | null>(null);

  // Tab System State
  const MAX_TABS = 10;
  const [activeMainTab, setActiveMainTab] = useState<'company' | 'individual'>('company');
  const [graphTabs, setGraphTabs] = useState<CompanyTab[]>([]);
  const [individualTabs, setIndividualTabs] = useState<IndividualTab[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const [activeCompanyTabId, setActiveCompanyTabId] = useState<string | null>(null);
  const [activeIndividualTabId, setActiveIndividualTabId] = useState<string | null>(null);

  // Sidebar State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleLog = useCallback((entry: LogEntry) => {
    setApiLogs(prev => [...prev, entry]);
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [apiLogs]);

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

  // Persist Snapshots
  useEffect(() => {
    localStorage.setItem('mitsuketa_snapshots', JSON.stringify(snapshots));
  }, [snapshots]);

  // Search Logic (Level 1: Find Entity or Person)
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    if (searchMode === 'person') {
      // Person search mode
      await handlePersonSearch(searchQuery.trim());
    } else {
      // Company search mode
      setIsLoading(true);
      setError(null);
      setSearchResults([]);
      setShowDropdown(false);
      setApiLogs([]); // Clear logs on new search

      try {
        const results = await searchEntities(searchQuery, config, handleLog);
        if (results.length === 0) {
          setError("No companies found with that name/NZBN.");
        } else {
          setSearchResults(results);
          setShowDropdown(true);
        }
      } catch (err: any) {
        setError(err.message || "Search failed.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Person Search Logic
  const handlePersonSearch = async (personName: string) => {
    setIsLoading(true);
    setError(null);
    setPersonSearchResults([]);
    setDisqualifiedMatches([]); // Reset
    setInsolvencyMatches([]); // Reset
    setApiLogs([]);

    try {
      console.log(`🔍 Searching for person: "${personName}"`);

      const searchPromises: Promise<any>[] = [
        searchByPersonName(personName, config.companiesKey, handleLog)
      ];

      // Always search disqualified directors (proxy handles key resolution)
      searchPromises.push(
        searchDisqualifiedDirectors(personName, config, handleLog)
          .catch(err => {
            console.warn("Disqualified Search failed", err);
            return { roles: [] };
          })
      );

      // Always search insolvency (proxy handles key resolution)
      searchPromises.push(
        searchInsolvency(personName, config, handleLog)
          .catch(err => {
            console.warn("Insolvency Search failed", err);
            return { searchResults: [] };
          })
      );

      const [personResults, disqualifiedResults, insolvencyResults] = await Promise.all(searchPromises);

      if (
        personResults.length === 0 &&
        (!disqualifiedResults.roles || disqualifiedResults.roles.length === 0) &&
        (!insolvencyResults.searchResults || insolvencyResults.searchResults.length === 0)
      ) {
        setError(`No directorship, shareholding, disqualification, or insolvency records found for "${personName}".`);
      } else {
        // Await NZBN enrichment for company statuses before updating UI
        let finalPersonResults = personResults;
        if (personResults.length > 0) {
          try {
            finalPersonResults = await enrichCompanyResults(personResults, config, handleLog);
            console.log(`✅ Enrichment complete for "${personName}"`);
          } catch (err) {
            console.warn('Enrichment failed:', err);
          }
        }

        setPersonSearchResults(finalPersonResults);
        setPersonSearchName(personName);

        if (disqualifiedResults.roles && disqualifiedResults.roles.length > 0) {
          console.log(`⚠️ Found ${disqualifiedResults.roles.length} disqualified director matches!`);
          setDisqualifiedMatches(disqualifiedResults.roles);
        }

        if (insolvencyResults.searchResults && insolvencyResults.searchResults.length > 0) {
          console.log(`⚠️ Found ${insolvencyResults.searchResults.length} insolvency record(s)!`);
          setInsolvencyMatches(insolvencyResults.searchResults);
        }

        console.log(`✅ Found ${finalPersonResults.length} companies for "${personName}"`);

        // Create a new Individual tab
        const tabId = `ind-${Date.now()}`;
        const newTab: IndividualTab = {
          id: tabId,
          label: personName,
          searchQuery: personName,
          personResults: finalPersonResults,
          disqualifiedMatches: disqualifiedResults.roles || [],
          insolvencyMatches: insolvencyResults.searchResults || [],
          isEnriching: false
        };

        setIndividualTabs(prev => {
          const updated = prev.length >= MAX_TABS ? [...prev.slice(1), newTab] : [...prev, newTab];
          return updated;
        });
        setActiveIndividualTabId(tabId);
        setActiveMainTab('individual');
      }
    } catch (err: any) {
      setError(err.message || "Person search failed.");
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
    const tabId = `comp-${Date.now()}`;
    const newTab: CompanyTab = {
      id: tabId,
      label: entity.entityName,
      nzbn: entity.nzbn,
      searchQuery: entity.entityName,
      nodes: [],
      edges: [],
      allNodesInMemory: [],
      isLoading: true
    };

    setGraphTabs(prev => {
      const updated = prev.length >= MAX_TABS ? [...prev.slice(1), newTab] : [...prev, newTab];
      return updated;
    });
    setActiveCompanyTabId(tabId);

    // Delegate to existing entity select logic which will populate the graph
    await handleSelectEntity(entity);

    // After loading, update the tab with the graph data
    // (This will be done via the existing setNodes/setEdges which we read in render)
  };

  const handleMainTabChange = (tab: 'company' | 'individual') => {
    setActiveMainTab(tab);
    if (tab === 'individual' && activeIndividualTabId) {
      // Restore the active individual tab's data
      const activeTab = individualTabs.find(t => t.id === activeIndividualTabId);
      if (activeTab) {
        setPersonSearchResults(activeTab.personResults);
        setPersonSearchName(activeTab.label);
        setDisqualifiedMatches(activeTab.disqualifiedMatches);
        setInsolvencyMatches(activeTab.insolvencyMatches);
        setSearchMode('person');
      }
    } else if (tab === 'company') {
      setSearchMode('company');
    }
  };

  const handleSubTabClick = (tabId: string) => {
    if (activeMainTab === 'company') {
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

  const handleSubTabClose = (tabId: string) => {
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
          }
        }
        return updated;
      });
    }
  };

  // Save current graph state back to the active company tab whenever nodes/edges change
  useEffect(() => {
    if (activeCompanyTabId && nodes.length > 0) {
      setGraphTabs(prev => prev.map(t =>
        t.id === activeCompanyTabId
          ? { ...t, nodes: nodes as any, edges: edges as any, allNodesInMemory, isLoading: false }
          : t
      ));
    }
  }, [nodes, edges, allNodesInMemory, activeCompanyTabId]);

  // Selection Logic (Level 2: Build Graph)
  const handleSelectEntity = async (entity: EntitySearchResultItem) => {
    setShowDropdown(false);
    setSearchQuery(entity.entityName);
    setIsGraphLoading(true);
    setError(null);
    hasAutoTidiedRef.current = false; // Reset for new graph
    setDebugData({ upstream: null, downstream: null, audit: null });
    setShowInspector(true); // Auto-open inspector on load for better UX given the requirement

    try {
      // Pass debug callback and logger
      const graph = await generateOrgChart(
        entity.nzbn,
        { ...config, includeInactive },
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
        handleLog
      );

      if (graph.nodes.length === 0) {
        setError("No corporate structure found for this entity.");
      } else {
        console.log('🔍 RAW GRAPH:', { nodeCount: graph.nodes.length, edgeCount: graph.edges.length });

        // Mark direct lineage and calculate hidden counts
        let processedNodes = markDirectLineage(graph.nodes, graph.edges, entity.nzbn);
        console.log('📊 AFTER LINEAGE MARKING:', {
          total: processedNodes.length,
          visible: processedNodes.filter(n => n.data.isVisible).length,
          hidden: processedNodes.filter(n => !n.data.isVisible).length
        });

        processedNodes = calculateHiddenDescendants(processedNodes, graph.edges);
        console.log('🎯 AFTER BADGE CALCULATION:',
          processedNodes.filter(n => n.data.hiddenDescendantCount).map(n => ({
            id: n.id,
            label: n.data.label,
            hiddenCount: n.data.hiddenDescendantCount
          }))
        );

        // Store ALL nodes in memory
        setAllNodesInMemory(processedNodes);

        // Filter to show only visible nodes
        const visibleNodes = processedNodes.filter(n => n.data.isVisible);
        console.log('👁️ VISIBLE NODES:', visibleNodes.map(n => n.data.label));

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
          visibleNodes,
          graph.edges
        );
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);

        // AUTO-TIDY: Automatically optimize layout after loading
        console.log('🎨 Auto-Tidy: Scheduling automatic layout optimization...');
        setTimeout(() => {
          console.log('🎨 Auto-Tidy: Running now...');
          const optimized = tidyUpLayout(layoutedNodes, layoutedEdges);
          setNodes(optimized.nodes);
          setEdges(optimized.edges);
          console.log('✨ Auto-Tidy: Complete!');

          // Background enrichment of nodes with NZBN insolvency data
          enrichGraphNodes(processedNodes, { ...config, includeInactive }, handleLog).then(enrichedNodes => {
            setAllNodesInMemory(enrichedNodes);
            setNodes(prevVars => prevVars.map(n => {
              const enriched = enrichedNodes.find(en => en.id === n.id);
              return enriched ? { ...n, data: enriched.data } : n;
            }) as any);
          });
        }, 300);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch corporate map.");
    } finally {
      setIsGraphLoading(false);
    }
  };

  const deleteSnapshot = (snapshotId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent loading the snapshot
    if (confirm('Delete this snapshot?')) {
      const updated = snapshots.filter(s => s.id !== snapshotId);
      setSnapshots(updated);
      localStorage.setItem('mitsuketa_snapshots', JSON.stringify(updated));
    }
  };

  const exportAsPNG = async () => {
    let element: HTMLElement | null = null;
    let filename = 'mitsuketa';

    if (searchMode === 'person' && personSearchResults.length > 0) {
      element = document.getElementById('person-search-results');
      filename = `person-results-${personSearchName.replace(/[^a-z0-9]/gi, '_')}`;
    } else if (nodes.length > 0) {
      element = document.querySelector('.react-flow') as HTMLElement;
      filename = `mitsuketa-${new Date().toISOString().split('T')[0]}`;
    }

    if (!element) return;

    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(element, {
        backgroundColor: theme === 'dark' ? '#020617' : '#f8fafc',
        quality: 1.0,
      });

      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export PNG:', err);
      setError('Failed to export as PNG');
    }
  };

  const exportAsPDF = async () => {
    let element: HTMLElement | null = null;

    if (searchMode === 'person' && personSearchResults.length > 0) {
      element = document.getElementById('person-search-results');
    } else if (nodes.length > 0) {
      element = document.querySelector('.react-flow') as HTMLElement;
    }

    if (!element) return;

    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(element, {
        backgroundColor: theme === 'dark' ? '#020617' : '#f8fafc',
        quality: 1.0,
      });

      const pdfWindow = window.open('', '_blank');
      if (pdfWindow) {
        pdfWindow.document.write(`
          <html>
            <head>
              <title>Mitsuketa PDF Export</title>
              <style>
                body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #fff; }
                img { max-width: 100%; max-height: 100%; object-fit: contain; }
                @media print {
                  body { height: auto; display: block; }
                  img { max-width: 100%; height: auto; }
                }
              </style>
            </head>
            <body>
              <img src="${dataUrl}" />
              <script>
                // Wait for image to load then print
                window.onload = function() { 
                  setTimeout(() => {
                    window.print(); 
                    // Optional: window.close() after print, but some browsers block it.
                  }, 500);
                }
              </script>
            </body>
          </html>
        `);
        pdfWindow.document.close();
      }
    } catch (err) {
      console.error('Failed to export PDF:', err);
      setError('Failed to export as PDF');
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
  };

  const exportAllSnapshots = () => {
    if (snapshots.length === 0) return;
    const json = JSON.stringify(snapshots, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `mitsuketa-all-snapshots-${new Date().toISOString().split('T')[0]}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importSnapshotRef = useRef<HTMLInputElement>(null);

  const triggerImportSnapshot = () => {
    importSnapshotRef.current?.click();
  };

  const handleImportSnapshot = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);

        // Simple verification
        if (!parsed.id || (!parsed.nodes && !parsed.personResults)) {
          setError("Invalid snapshot format");
          return;
        }

        // Generate new ID to avoid collisions
        const newSnap = {
          ...parsed,
          id: Date.now().toString(),
          name: `${parsed.name} (Imported)`,
          dateCreated: Date.now()
        };

        const updated = [newSnap, ...snapshots];
        setSnapshots(updated);
        localStorage.setItem('mitsuketa_snapshots', JSON.stringify(updated));

      } catch (err) {
        console.error("Import failed", err);
        setError("Failed to import snapshot");
      }
    };
    reader.readAsText(file);
    // Reset inputs
    event.target.value = '';
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
    setError(null);
    setApiLogs([]);
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

  const takeSnapshot = () => {
    if (searchMode === 'person') {
      if (personSearchResults.length === 0) return;
      const snap: GraphSnapshot = {
        id: Date.now().toString(),
        name: `Person: ${personSearchName} (${new Date().toLocaleTimeString()})`,
        dateCreated: Date.now(),
        searchType: 'person',
        searchQuery: personSearchName,
        nodes: [],
        edges: [],
        personResults: personSearchResults
      };
      setSnapshots([snap, ...snapshots]);
    } else {
      if (nodes.length === 0) return;
      const snap: GraphSnapshot = {
        id: Date.now().toString(),
        name: `Graph: ${nodes[0].data.label} (${new Date().toLocaleTimeString()})`,
        dateCreated: Date.now(),
        searchType: 'company',
        searchQuery: nodes[0].data.label,
        nodes,
        edges
      };
      setSnapshots([snap, ...snapshots]);
    }
  };

  const loadSnapshot = (snap: GraphSnapshot) => {
    if (snap.searchType === 'person') {
      setSearchMode('person');
      setPersonSearchResults(snap.personResults || []);
      setPersonSearchName(snap.searchQuery || '');
      setNodes([]);
      setEdges([]);
    } else {
      setSearchMode('company');
      setPersonSearchResults([]);
      setPersonSearchName('');
      setNodes(snap.nodes);
      setEdges(snap.edges);
    }
  };

  // Context Menu Handlers
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({
      nodeId: node.id,
      nodeLabel: node.data.label,
      nodeType: node.type || 'companyNode',
      nzbn: node.data.nzbn,
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

    // Re-layout the graph with the new target node as the visual center
    // This will rearrange nodes into a pyramid with target in middle
    const { nodes: relayoutedNodes, edges: relayoutedEdges } = getLayoutedElements(
      updatedNodes,
      edges
    );

    // Apply the new layout positions
    setNodes(relayoutedNodes);
    setEdges(relayoutedEdges);
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

    // Reset all nodes to full opacity
    setNodes((nds) =>
      nds.map(n => ({
        ...n,
        style: {
          ...n.style,
          opacity: 1,
          pointerEvents: 'auto'
        }
      }))
    );

    // Show all edges
    setEdges((eds) =>
      eds.map(e => ({
        ...e,
        hidden: false
      }))
    );
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

  const handleExpandStructure = (nodeId: string, nzbn: string, label: string) => {
    setContextMenu(null);

    console.log('🚀 EXPANDING:', { nodeId, nzbn, label });
    console.log('📦 NODES IN MEMORY:', allNodesInMemory.length);
    console.log('📦 ALL NODE LABELS:', allNodesInMemory.map(n => ({ id: n.id, label: n.data.label, isVisible: n.data.isVisible })));
    console.log('📦 CURRENTLY VISIBLE:', nodes.length);

    // Expand the subtree in memory
    let expandedNodes = expandNodeSubtree(allNodesInMemory, edges, nodeId);

    const newlyVisible = expandedNodes.filter(n => n.data.isVisible).length;
    console.log('✨ AFTER EXPAND, VISIBLE COUNT:', newlyVisible);
    console.log('✨ NEWLY VISIBLE NODES:', expandedNodes.filter(n => n.data.isVisible).map(n => ({ id: n.id, label: n.data.label })));

    // Recalculate hidden counts after expansion
    expandedNodes = calculateHiddenDescendants(expandedNodes, edges);

    // Update memory
    setAllNodesInMemory(expandedNodes);

    // Filter visible nodes and re-layout
    const visibleNodes = expandedNodes.filter(n => n.data.isVisible);
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      visibleNodes,
      edges
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  };

  const handleCollapseBranch = (nodeId: string, nzbn: string, label: string) => {
    setContextMenu(null);

    // Collapse the subtree in memory
    let collapsedNodes = collapseNodeSubtree(allNodesInMemory, edges, nodeId);

    // Recalculate hidden counts after collapse
    collapsedNodes = calculateHiddenDescendants(collapsedNodes, edges);

    // Update memory
    setAllNodesInMemory(collapsedNodes);

    // Filter visible nodes and re-layout
    const visibleNodes = collapsedNodes.filter(n => n.data.isVisible);
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      visibleNodes,
      edges
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
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



  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <ConfigBar
        config={config}
        onConfigChange={setConfig}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <main className="flex-1 flex mt-16 relative overflow-hidden">
        {/* Sidebar Toggle Button - positioned on the edge of the sidebar */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={`absolute top-1/2 -translate-y-1/2 z-30 p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg transition-all hover:bg-slate-50 dark:hover:bg-slate-700 ${isSidebarCollapsed ? 'left-2' : 'left-[376px]'
            }`}
          title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isSidebarCollapsed ? <ChevronRight size={16} className="text-gray-600 dark:text-gray-300" /> : <ChevronLeft size={16} className="text-gray-600 dark:text-gray-300" />}
        </button>

        {/* Sidebar */}
        <div className={`${isSidebarCollapsed ? 'w-0' : 'w-96'
          } bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-20 shadow-xl transition-all duration-300 ease-in-out overflow-hidden`}>

          {/* Search Section */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 relative">
            <h2 className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Search</h2>

            {/* Search Mode Toggle */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => {
                  setSearchMode('company');
                  setActiveMainTab('company');
                  setSearchQuery('');
                  setError(null);
                }}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${searchMode === 'company'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
              >
                <Building2 size={16} />
                Company
              </button>
              <button
                onClick={() => {
                  setSearchMode('person');
                  setActiveMainTab('individual');
                  setSearchResults([]);
                  setShowDropdown(false);
                  setSearchQuery('');
                  setError(null);
                }}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${searchMode === 'person'
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
              >
                <User size={16} />
                Person
              </button>
            </div>

            <form onSubmit={handleSearch} className="flex gap-2 relative">
              <div className="relative flex-1 group">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={searchMode === 'person' ? 'Search by director/shareholder name...' : 'Search companies by name or NZBN...'}
                  className="w-full bg-slate-100 dark:bg-slate-800 text-gray-900 dark:text-white rounded-l px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:outline-none placeholder-slate-500 transition-colors"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={isLoading || isGraphLoading}
                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-r transition-colors disabled:opacity-50 flex items-center justify-center min-w-[44px]"
              >
                {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
              </button>
            </form>

            {/* Include Inactive Entities Toggle */}
            <div className="mt-3 flex items-center gap-2 px-1">
              <input
                type="checkbox"
                id="include-inactive"
                checked={includeInactive}
                onChange={(e) => {
                  if (e.target.checked) {
                    setShowInactiveWarning(true);
                  } else {
                    setIncludeInactive(false);
                  }
                }}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="include-inactive" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                Include inactive/removed entities
              </label>
            </div>

            {error && (
              <div className="mt-3 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-2 rounded flex gap-2 items-start">
                <AlertTriangle className="text-red-600 dark:text-red-500 shrink-0 mt-0.5" size={14} />
                <p className="text-xs text-red-600 dark:text-red-300 leading-tight">{error}</p>
              </div>
            )}

            {/* Dropdown Results */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mx-4 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl z-50 max-h-80 overflow-y-auto">
                <div className="sticky top-0 bg-slate-50 dark:bg-slate-900/90 backdrop-blur px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold flex justify-between items-center">
                  <span>Matches found ({searchResults.length})</span>
                  <button onClick={() => setShowDropdown(false)} className="hover:text-blue-500"><X size={12} /></button>
                </div>
                {searchResults.map((entity) => (
                  <button
                    key={entity.nzbn}
                    onClick={() => handleSelectEntityInTab(entity)}
                    className="w-full text-left px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 hover:bg-blue-50 dark:hover:bg-slate-700/50 transition-colors flex items-start gap-3 group"
                  >
                    <div className="mt-1 p-1.5 bg-slate-100 dark:bg-slate-900 rounded text-slate-400 dark:text-slate-500 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      <Building2 size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-700 dark:group-hover:text-blue-300">
                        {entity.entityName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{entity.nzbn}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase font-bold ${entity.entityStatusDescription.toLowerCase().includes('registered')
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                          }`}>
                          {entity.entityStatusDescription}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>



          {/* Snapshots */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">Snapshots</h2>
              <div className="flex items-center gap-1">
                <input
                  type="file"
                  ref={importSnapshotRef}
                  onChange={handleImportSnapshot}
                  accept=".json"
                  className="hidden"
                />
                <button onClick={triggerImportSnapshot} className="mr-1 text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors" title="Import Snapshot">
                  <Upload size={16} />
                </button>
                <button onClick={takeSnapshot} className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-white transition-colors" title="Save Snapshot">
                  <Camera size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {snapshots.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-600 italic">No snapshots saved.</p>
              )}
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="p-3 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500/50 rounded transition-all group relative"
                >
                  <div onClick={() => loadSnapshot(snap)} className="cursor-pointer">
                    <p className="text-sm text-gray-700 dark:text-gray-300 font-medium truncate group-hover:text-blue-600 dark:group-hover:text-blue-300">{snap.name}</p>
                    <p className="text-[10px] text-gray-500">{new Date(snap.dateCreated).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={(e) => deleteSnapshot(snap.id, e)}
                    className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete snapshot"
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); exportSnapshot(snap); }}
                    className="absolute bottom-2 right-2 p-1 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Export Snapshot (JSON)"
                  >
                    <Download size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Legend */}
          <div className="hidden border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-600 flex-shrink-0">
            {/* Legend removed */}
          </div>

          {/* Export Section */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
            <h2 className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Export</h2>
            <div className="space-y-2">
              <button
                onClick={exportAsPNG}
                disabled={nodes.length === 0 && personSearchResults.length === 0}
                className="w-full px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded flex items-center justify-center gap-2 transition-colors"
              >
                <FileDown size={16} />
                Export as PNG
              </button>
              <button
                onClick={exportAsPDF}
                disabled={nodes.length === 0 && personSearchResults.length === 0}
                className="w-full px-3 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded flex items-center justify-center gap-2 transition-colors"
              >
                <FileDown size={16} />
                Export as PDF
              </button>
              <button
                onClick={exportAllSnapshots}
                disabled={snapshots.length === 0}
                className="w-full px-3 py-2 text-sm bg-slate-600 hover:bg-slate-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded flex items-center justify-center gap-2 transition-colors"
              >
                <Database size={16} />
                Export Snapshots
              </button>
            </div>
          </div>
        </div>

        {/* Graph Area & Network Console */}
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-gray-950 relative transition-colors duration-300">
          {isGraphLoading && (
            <div className="absolute inset-0 z-50 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm flex items-center justify-center flex-col gap-4">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Mapping Corporate Structure...</p>
            </div>
          )}

          {/* Tab Bar */}
          <TabBar
            activeMainTab={activeMainTab}
            onMainTabChange={handleMainTabChange}
            companyTabs={graphTabs.map(t => ({ id: t.id, label: t.label, isLoading: t.isLoading }))}
            individualTabs={individualTabs.map(t => ({ id: t.id, label: t.label, isLoading: t.isEnriching }))}
            activeSubTabId={activeMainTab === 'company' ? activeCompanyTabId : activeIndividualTabId}
            onSubTabClick={handleSubTabClick}
            onSubTabClose={handleSubTabClose}
          />

          <div className="flex-1 relative">
            {/* Show Person Search Results OR ReactFlow Graph based on active main tab */}
            {activeMainTab === 'individual' && (personSearchResults.length > 0 || disqualifiedMatches.length > 0 || insolvencyMatches.length > 0) ? (
              <PersonSearchResults
                personName={personSearchName}
                results={personSearchResults}
                disqualifiedDirectors={disqualifiedMatches}
                insolvencyRecords={insolvencyMatches}
                onCompanyClick={handleCompanyCardClick}
                onBack={() => {
                  setPersonSearchResults([]);
                  setDisqualifiedMatches([]);
                  setInsolvencyMatches([]);
                  setPersonSearchName('');
                  setSearchQuery('');
                }}
              />
            ) : nodes.length === 0 && !isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center">
                <div className="max-w-md space-y-4">
                  <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center mb-6">
                    <Search className="text-blue-600 dark:text-blue-400" size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-white">Begin your investigation</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    Enter a company name or NZBN in the search bar above to map its corporate structure, or switch to Person Mode to find an individual's directorships.
                  </p>
                  <div className="pt-4 flex justify-center gap-2 text-xs text-slate-500 dark:text-slate-500">
                    <span className="bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-700">Ctrl</span>
                    <span>+</span>
                    <span className="bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-700">K</span>
                    <span>to focus search</span>
                  </div>
                </div>
              </div>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                onNodeContextMenu={handleNodeContextMenu}
                onPaneClick={handlePaneClick}
                nodeTypes={nodeTypes}
                fitView
                className="bg-slate-50 dark:bg-slate-950"
                minZoom={0.1}
              >
                <Background color={theme === 'dark' ? "#1e293b" : "#e2e8f0"} gap={16} />
                <Controls className="!bg-white dark:!bg-slate-800 !border-slate-200 dark:!border-slate-700 [&>button]:!fill-gray-600 dark:[&>button]:!fill-gray-300 hover:[&>button]:!fill-black dark:hover:[&>button]:!fill-white" />

                {/* Tidy Up Controls - Only show after graph loads */}
                {nodes.length > 0 && (
                  <Panel position="bottom-left" className="mb-2 ml-2">
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={handleTidyUp}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                        title="Optimize layout into compact pyramid shape"
                      >
                        <Sparkles size={18} className="text-blue-500" />
                        <span>Tidy Up</span>
                      </button>

                      {originalLayout && (
                        <button
                          onClick={handleUndoTidyUp}
                          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                          title="Revert to original layout"
                        >
                          <Undo size={18} className="text-orange-500" />
                          <span>Undo</span>
                        </button>
                      )}
                    </div>
                  </Panel>
                )}

                {nodes.length === 0 && !isLoading && !isGraphLoading && !error && (
                  <Panel position="top-center" className="mt-20">
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-slate-200 dark:border-slate-700 p-8 rounded-xl text-center max-w-md shadow-xl">
                      <MousePointer2 className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Ready to Map</h3>
                      <p className="text-slate-600 dark:text-slate-400">
                        Search for a company by name or NZBN in the sidebar to begin.
                      </p>
                    </div>
                  </Panel>
                )}
              </ReactFlow>
            )}

            {/* Context Menu */}
            {contextMenu && (
              <NodeContextMenu
                nodeId={contextMenu.nodeId}
                nodeLabel={contextMenu.nodeLabel}
                nodeType={contextMenu.nodeType}
                nzbn={contextMenu.nzbn}
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
                  handlePersonSearch(name);
                }}
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

            {/* Inactive Entity Warning Dialog */}
            {showInactiveWarning && (
              <>
                <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowInactiveWarning(false)} />
                <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 p-6 max-w-md">
                  <div className="flex items-start gap-3 mb-4">
                    <AlertTriangle className="text-yellow-500 shrink-0 mt-1" size={24} />
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Warning</h3>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        This will display ALL inactive entities associated with your search, which could potentially result in a longer search time and a more complicated graph depending on the search.
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 font-semibold">
                        Do you still wish to proceed?
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setShowInactiveWarning(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setIncludeInactive(true);
                        setShowInactiveWarning(false);
                      }}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
                    >
                      Proceed
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer Disclaimer */}
      <footer className="bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-2 px-4 text-center">
        <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
          <strong>Mitsuketa 見つけた</strong> &bull; Data sourced from MBIE registers &bull; Not for unlawful commercial use
        </p>
      </footer>
    </div>
  );
}

export default App;