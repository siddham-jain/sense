import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ZoomIn, ZoomOut, RotateCcw, Filter, Calendar, Eye, Sparkles, 
  RefreshCw, Maximize2, Minimize2, Target, Layers, Activity
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import * as THREE from 'three';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// Sci-Fi Color Palette
const COLORS = {
  dark: {
    background: '#030303',
    gold: '#D4AF37',
    goldDim: '#8B7355',
    alabaster: '#F9F8F6',
    charcoal: '#1A1A1A',
    warmGrey: '#6C6863',
    entity: '#D4AF37',
    domain: '#4A9EFF',
    phrase: '#9B59B6',
    abstract: '#00D9FF',
    glow: 'rgba(212, 175, 55, 0.6)',
  },
  light: {
    background: '#F9F8F6',
    gold: '#B8942E',
    goldDim: '#6C6863',
    alabaster: '#F9F8F6',
    charcoal: '#1A1A1A',
    warmGrey: '#6C6863',
    entity: '#B8942E',
    domain: '#2563EB',
    phrase: '#7C3AED',
    abstract: '#0891B2',
    glow: 'rgba(184, 148, 46, 0.4)',
  }
};

export default function KnowledgeGraphPage() {
  const graphRef = useRef();
  const containerRef = useRef();
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [showFilters, setShowFilters] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [timeRange, setTimeRange] = useState(30);
  const [minFrequency, setMinFrequency] = useState(1);
  const [graphStats, setGraphStats] = useState(null);
  const [dataSource, setDataSource] = useState('db');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const { user, session } = useAuth();
  const { isDark } = useTheme();
  
  const colors = isDark ? COLORS.dark : COLORS.light;

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Use the bounding rect or fallback to window size
        const width = rect.width > 0 ? rect.width : window.innerWidth;
        const height = rect.height > 0 ? rect.height : window.innerHeight - 100;
        setDimensions({ width, height });
      } else {
        // Fallback to window dimensions
        setDimensions({
          width: window.innerWidth,
          height: window.innerHeight - 100
        });
      }
    };
    
    // Initial update with small delay to ensure DOM is ready
    const timeoutId = setTimeout(updateDimensions, 100);
    updateDimensions();
    
    window.addEventListener('resize', updateDimensions);
    return () => {
      window.removeEventListener('resize', updateDimensions);
      clearTimeout(timeoutId);
    };
  }, [loading, graphData.nodes.length]);

  useEffect(() => {
    if (user && session) {
      fetchGraphData();
    }
  }, [user, session, timeRange, minFrequency, dataSource]);

  // Configure control sensitivity when graph data loads
  useEffect(() => {
    if (graphData.nodes.length > 0 && graphRef.current) {
      // Small delay to ensure controls are initialized
      const timer = setTimeout(() => {
        const controls = graphRef.current?.controls();
        if (controls) {
          // Increase rotation, zoom, and pan sensitivity
          controls.rotateSpeed = 1.5;  // Default is 1.0
          controls.zoomSpeed = 2.0;    // Default is 1.0
          controls.panSpeed = 1.5;     // Default is 1.0
          controls.enableDamping = true;
          controls.dampingFactor = 0.1;
          console.log('Graph controls configured with increased sensitivity');
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [graphData.nodes.length]);

  const getAuthHeaders = () => {
    if (session?.access_token) {
      return {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      };
    }
    return { 'Content-Type': 'application/json' };
  };

  const fetchGraphData = async () => {
    if (!user || !session) return;
    setLoading(true);

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/graph/data?days=${timeRange}&min_frequency=${minFrequency}&source=${dataSource}`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) throw new Error('Failed to fetch graph data');

      const data = await response.json();
      const transformedData = transformGraphData(data);
      setGraphData(transformedData);
      setGraphStats({
        nodes: transformedData.nodes.length,
        links: transformedData.links.length,
        source: data.source || dataSource
      });
    } catch (err) {
      console.error('Failed to fetch graph data:', err);
      setGraphData({ nodes: [], links: [] });
    } finally {
      setLoading(false);
    }
  };

  const transformGraphData = (data) => {
    const nodes = (data.nodes || []).map(node => ({
      id: node.id,
      label: node.label,
      type: node.type || node.kind || 'entity',
      frequency: node.frequency || 1,
      confidence: node.confidence || 1.0,
      recency_score: node.recency_score || 0.5,
    }));

    const nodeIds = new Set(nodes.map(n => n.id));
    const links = (data.links || []).filter(link => 
      nodeIds.has(link.source) && nodeIds.has(link.target)
    ).map(link => ({
      source: link.source,
      target: link.target,
      strength: link.strength || link.weight || 1,
      relation: link.relation || 'related_to',
    }));

    return { nodes, links };
  };

  const getNodeColor = useCallback((type) => {
    switch (type) {
      case 'entity': return colors.entity;
      case 'domain': return colors.domain;
      case 'phrase': return colors.phrase;
      case 'abstract': return colors.abstract;
      default: return colors.gold;
    }
  }, [colors]);

  const generateGraph = async () => {
    if (!user || !session) {
      toast.error('Please sign in to generate your graph');
      return;
    }

    setGenerating(true);

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/graph/generate?days=${timeRange}&use_llm=true`,
        { method: 'POST', headers: getAuthHeaders() }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to generate graph');
      }

      const result = await response.json();
      
      if (result.stats?.nodes === 0 || result.node_count === 0) {
        toast.info('No browsing data found. Install the Sense extension and browse the web.');
      } else {
        toast.success(`Graph generated: ${result.node_count || 0} nodes, ${result.edge_count || 0} edges`);
      }
      
      setDataSource('db');
      await fetchGraphData();
    } catch (err) {
      console.error('Failed to generate graph:', err);
      toast.error(err.message || 'Failed to generate graph');
    } finally {
      setGenerating(false);
    }
  };

  // Elegant 3D node rendering - warm glow aesthetic per design guidelines
  const nodeThreeObject = useCallback((node) => {
    const isHovered = hoveredNode?.id === node.id;
    const isSelected = selectedNode?.id === node.id;
    const isConnected = selectedNode && graphData.links.some(l => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;
      return (sourceId === selectedNode.id && targetId === node.id) ||
             (targetId === selectedNode.id && sourceId === node.id);
    });

    // Dynamic sizing based on frequency
    const maxFreq = Math.max(...graphData.nodes.map(n => n.frequency || 1), 1);
    const sizeMultiplier = isSelected ? 1.4 : isHovered ? 1.15 : 1;
    const baseRadius = 4 + ((node.frequency || 1) / maxFreq) * 10;
    const radius = baseRadius * sizeMultiplier;
    
    const group = new THREE.Group();
    const nodeColor = getNodeColor(node.type);
    
    // Soft outer glow sphere (larger, very transparent) - creates bloom effect
    if (isSelected || isHovered || isConnected) {
      const glowGeometry = new THREE.SphereGeometry(radius * 1.8, 24, 24);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(nodeColor),
        transparent: true,
        opacity: isSelected ? 0.15 : isHovered ? 0.1 : 0.06,
      });
      const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
      group.add(glowMesh);
    }
    
    // Main sphere - clean, solid appearance with subtle emission
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshPhongMaterial({
      color: new THREE.Color(nodeColor),
      emissive: new THREE.Color(nodeColor),
      emissiveIntensity: isSelected ? 0.5 : isHovered ? 0.35 : isConnected ? 0.25 : 0.15,
      shininess: 60,
      transparent: true,
      opacity: focusMode && selectedNode && !isSelected && !isConnected ? 0.15 : 0.95,
    });

    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);
    
    // Inner bright core for selected/hovered - creates depth
    if (isSelected || isHovered) {
      const coreGeometry = new THREE.SphereGeometry(radius * 0.4, 16, 16);
      const coreMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colors.alabaster),
        transparent: true,
        opacity: isSelected ? 0.9 : 0.6,
      });
      const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
      group.add(coreMesh);
    }

    // Add minimalistic label - only show on hover/selection or for important nodes
    const showLabel = isHovered || isSelected || (node.frequency || 1) >= 3;
    
    if (showLabel) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Measure text to create appropriately sized canvas
      const labelText = (node.label || '').substring(0, 24);
      canvas.width = 400;
      canvas.height = isSelected ? 80 : 48;
      
      // Subtle frosted glass background with rounded corners
      ctx.fillStyle = isDark ? 'rgba(3, 3, 3, 0.75)' : 'rgba(249, 248, 246, 0.85)';
      const bgPadding = 16;
      const cornerRadius = 8;
      
      // Draw rounded rectangle
      ctx.beginPath();
      ctx.roundRect(bgPadding, 4, canvas.width - bgPadding * 2, canvas.height - 8, cornerRadius);
      ctx.fill();
      
      // Subtle accent line on the left
      ctx.fillStyle = nodeColor;
      ctx.fillRect(bgPadding, 4, 3, canvas.height - 8);
      
      // Node label - clean, centered text
      ctx.font = '500 28px Inter, system-ui, sans-serif';
      ctx.fillStyle = isDark ? colors.alabaster : colors.charcoal;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, canvas.width / 2, isSelected ? 28 : canvas.height / 2);
      
      // Only show type indicator for selected nodes (subtle)
      if (isSelected) {
        ctx.font = '400 14px Inter, system-ui, sans-serif';
        ctx.fillStyle = nodeColor;
        ctx.globalAlpha = 0.8;
        ctx.fillText(node.type?.toUpperCase() || 'NODE', canvas.width / 2, 56);
        ctx.globalAlpha = 1;
      }

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture, 
        transparent: true,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.scale.set(isSelected ? 50 : 40, isSelected ? 10 : 6, 1);
      sprite.position.set(0, radius + 10, 0);
      group.add(sprite);
    }

    return group;
  }, [hoveredNode, selectedNode, graphData.links, graphData.nodes, colors, isDark, focusMode, getNodeColor]);

  // Enhanced link styling
  const linkColor = useCallback((link) => {
    if (focusMode && selectedNode) {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      const isConnected = sourceId === selectedNode.id || targetId === selectedNode.id;
      if (!isConnected) return 'rgba(212, 175, 55, 0.03)';
    }
    
    if (selectedNode) {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      const isConnected = sourceId === selectedNode.id || targetId === selectedNode.id;
      return isConnected ? colors.gold : 'rgba(212, 175, 55, 0.08)';
    }
    
    const opacity = 0.1 + ((link.strength || 1) / 10) * 0.25;
    return `rgba(212, 175, 55, ${opacity})`;
  }, [selectedNode, colors, focusMode]);

  const linkWidth = useCallback((link) => {
    if (selectedNode) {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      const isConnected = sourceId === selectedNode.id || targetId === selectedNode.id;
      if (isConnected) return 2 + ((link.strength || 1) / 5) * 2;
    }
    return 0.5 + ((link.strength || 1) / 10) * 1.5;
  }, [selectedNode]);

  // Camera controls - Increased zoom factors for better responsiveness
  const handleZoomIn = () => graphRef.current?.zoom(2.0, 600);   // Was 1.5
  const handleZoomOut = () => graphRef.current?.zoom(0.5, 600);  // Was 0.7
  const handleReset = () => {
    if (graphRef.current) {
      // Calculate center of all nodes
      const nodes = graphData.nodes;
      if (nodes.length > 0) {
        let centerX = 0, centerY = 0, centerZ = 0;
        nodes.forEach(n => {
          centerX += n.x || 0;
          centerY += n.y || 0;
          centerZ += n.z || 0;
        });
        centerX /= nodes.length;
        centerY /= nodes.length;
        centerZ /= nodes.length;
        
        // Position camera to view centered graph
        const distance = 300;
        graphRef.current.cameraPosition(
          { x: centerX, y: centerY, z: centerZ + distance },
          { x: centerX, y: centerY, z: centerZ },
          1500
        );
      } else {
        // Default position if no nodes
        graphRef.current.cameraPosition(
          { x: 0, y: 0, z: 300 },
          { x: 0, y: 0, z: 0 },
          1500
        );
      }
      
      // Re-enable controls after reset
      const controls = graphRef.current.controls();
      if (controls) {
        controls.enabled = true;
        controls.enableRotate = true;
        controls.enableZoom = true;
        controls.enablePan = true;
      }
    }
    setSelectedNode(null);
    setFocusMode(false);
  };

  const handleNodeClick = useCallback((node) => {
    if (selectedNode?.id === node.id) {
      setSelectedNode(null);
      setFocusMode(false);
      // Reset to center view
      if (graphRef.current) {
        const nodes = graphData.nodes;
        let centerX = 0, centerY = 0, centerZ = 0;
        nodes.forEach(n => {
          centerX += n.x || 0;
          centerY += n.y || 0;
          centerZ += n.z || 0;
        });
        if (nodes.length > 0) {
          centerX /= nodes.length;
          centerY /= nodes.length;
          centerZ /= nodes.length;
        }
        graphRef.current.cameraPosition(
          { x: centerX, y: centerY, z: centerZ + 300 },
          { x: centerX, y: centerY, z: centerZ },
          1500
        );
      }
    } else {
      setSelectedNode(node);
      const distance = 100;
      const distRatio = 1 + distance / Math.hypot(node.x || 1, node.y || 1, node.z || 1);
      graphRef.current?.cameraPosition(
        { x: (node.x || 0) * distRatio, y: (node.y || 0) * distRatio, z: (node.z || 0) * distRatio },
        node,
        1200
      );
    }
  }, [selectedNode, graphData.nodes]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <AppLayout>
        <div className="w-full h-full bg-background">
          <FullScreenLoader message="Initializing neural network" isDark={isDark} />
        </div>
      </AppLayout>
    );
  }

  // Generating state
  if (generating) {
    return (
      <AppLayout>
        <div className="w-full h-full bg-background">
          <GeneratingAnimation isDark={isDark} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div 
        ref={containerRef} 
        className="graph-container relative w-full"
        style={{ 
          background: colors.background,
          height: 'calc(100vh - 64px)', // Full viewport minus header
          minHeight: '600px'
        }}
        data-testid="graph-canvas"
      >
        {graphData.nodes.length === 0 ? (
          <EmptyGraphState onGenerate={generateGraph} isDark={isDark} />
        ) : (
          <>
            {/* Sci-fi background effects */}
            {isDark && (
              <>
                <div className="graph-starfield" />
                <div className="graph-grid" />
                <div className="graph-vignette" />
                <div className="graph-scanline" />
              </>
            )}

            {/* 3D Force Graph */}
            <ForceGraph3D
              ref={graphRef}
              width={dimensions.width}
              height={dimensions.height}
              graphData={graphData}
              backgroundColor="rgba(0,0,0,0)"
              nodeThreeObject={nodeThreeObject}
              nodeThreeObjectExtend={false}
              linkColor={linkColor}
              linkWidth={linkWidth}
              linkOpacity={0.8}
              linkDirectionalParticles={2}
              linkDirectionalParticleWidth={1}
              linkDirectionalParticleSpeed={0.005}
              linkDirectionalParticleColor={() => colors.gold}
              onNodeClick={handleNodeClick}
              onNodeHover={setHoveredNode}
              enableNodeDrag={true}
              enableNavigationControls={true}
              controlType="orbit"
              showNavInfo={false}
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.3}
              warmupTicks={100}
              cooldownTicks={Infinity}
              onEngineStop={() => {
                // Ensure controls stay enabled after simulation stops
                const controls = graphRef.current?.controls();
                if (controls) {
                  controls.enabled = true;
                  controls.enableRotate = true;
                  controls.enableZoom = true;
                  controls.enablePan = true;
                  // Increase sensitivity for better UX
                  controls.rotateSpeed = 1.5;
                  controls.zoomSpeed = 2.0;
                  controls.panSpeed = 1.5;
                }
              }}
              onEngineTick={() => {
                // Continuously ensure controls have proper sensitivity
                const controls = graphRef.current?.controls();
                if (controls && controls.rotateSpeed !== 1.5) {
                  controls.rotateSpeed = 1.5;
                  controls.zoomSpeed = 2.0;
                  controls.panSpeed = 1.5;
                }
              }}
            />

            {/* HUD Controls - Left */}
            <div className="absolute top-6 left-6 flex flex-col gap-2 z-10">
              {[
                { icon: ZoomIn, action: handleZoomIn, testId: 'graph-zoom-in', label: 'Zoom In' },
                { icon: ZoomOut, action: handleZoomOut, testId: 'graph-zoom-out', label: 'Zoom Out' },
                { icon: RotateCcw, action: handleReset, testId: 'graph-reset', label: 'Reset View' },
                { icon: Target, action: () => setFocusMode(!focusMode), testId: 'graph-focus', label: 'Focus Mode', active: focusMode },
                { icon: isFullscreen ? Minimize2 : Maximize2, action: toggleFullscreen, testId: 'graph-fullscreen', label: 'Fullscreen' },
              ].map(({ icon: Icon, action, testId, label, active }) => (
                <button
                  key={testId}
                  onClick={action}
                  data-testid={testId}
                  title={label}
                  className={`graph-control-btn ${active ? 'active' : ''}`}
                >
                  <Icon size={16} strokeWidth={1.5} />
                </button>
              ))}
              
              <div className="w-10 h-px bg-[#D4AF37]/20 my-2" />
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`graph-control-btn ${showFilters ? 'active' : ''}`}
                data-testid="graph-filter-toggle"
                title="Filters"
              >
                <Filter size={16} strokeWidth={1.5} />
              </button>
              
              <button
                onClick={() => setShowLegend(!showLegend)}
                className={`graph-control-btn ${showLegend ? 'active' : ''}`}
                data-testid="graph-legend-toggle"
                title="Legend"
              >
                <Layers size={16} strokeWidth={1.5} />
              </button>
            </div>

            {/* Generate Button - Top Center */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
              <Button
                onClick={generateGraph}
                disabled={generating}
                data-testid="generate-graph-button"
                className="hud-panel hud-bracket bg-transparent hover:bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/40 hover:border-[#D4AF37] px-6 py-2 uppercase tracking-[0.2em] text-[10px] font-mono-tech transition-all duration-300 flex items-center gap-3"
              >
                <Sparkles size={14} />
                <span>Regenerate Graph</span>
              </Button>
            </div>

            {/* Legend Panel - Right */}
            <AnimatePresence>
              {showLegend && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="absolute right-6 top-6 hud-panel hud-bracket p-5 w-52"
                  data-testid="graph-legend"
                >
                  <div className="flex items-center justify-between mb-4">
                    <p className="font-mono-tech text-[#D4AF37]">NODE TYPES</p>
                    <button onClick={() => setShowLegend(false)} className="text-[#F9F8F6]/40 hover:text-[#F9F8F6]">
                      <X size={12} />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {[
                      { color: colors.entity, label: 'Entities', desc: 'Named things' },
                      { color: colors.domain, label: 'Domains', desc: 'Websites' },
                      { color: colors.phrase, label: 'Phrases', desc: 'Key concepts' },
                      { color: colors.abstract, label: 'Themes', desc: 'Abstract ideas' }
                    ].map(({ color, label, desc }) => (
                      <div key={label} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
                        <div>
                          <span className="text-[11px] text-[#F9F8F6]/80 block">{label}</span>
                          <span className="text-[9px] text-[#F9F8F6]/40">{desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-[#D4AF37]/20 mt-4 pt-4 space-y-2 font-mono-tech text-[9px] text-[#F9F8F6]/40">
                    <p>NODE SIZE = FREQUENCY</p>
                    <p>LINK WIDTH = STRENGTH</p>
                    <p>PARTICLES = DATA FLOW</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stats HUD - Bottom Left */}
            <div className="absolute left-6 bottom-6 hud-panel px-4 py-3 flex items-center gap-6 font-mono-tech">
              <div className="flex items-center gap-2">
                <Activity size={12} className="text-[#D4AF37]" />
                <span className="text-[#F9F8F6]/60">{graphData.nodes.length}</span>
                <span className="text-[#F9F8F6]/30">NODES</span>
              </div>
              <div className="w-px h-4 bg-[#D4AF37]/20" />
              <div className="flex items-center gap-2">
                <span className="text-[#F9F8F6]/60">{graphData.links.length}</span>
                <span className="text-[#F9F8F6]/30">LINKS</span>
              </div>
              {graphStats?.source && (
                <>
                  <div className="w-px h-4 bg-[#D4AF37]/20" />
                  <span className="text-[#D4AF37]">
                    {graphStats.source === 'database' ? 'AI GENERATED' : 'LIVE DATA'}
                  </span>
                </>
              )}
            </div>

            {/* Source Toggle - Bottom Right */}
            <div className="absolute right-6 bottom-6">
              <button
                onClick={() => setDataSource(dataSource === 'db' ? 'live' : 'db')}
                data-testid="toggle-data-source"
                className="hud-panel px-4 py-2 flex items-center gap-2 font-mono-tech text-[10px] text-[#F9F8F6]/60 hover:text-[#D4AF37] transition-all duration-300"
              >
                <RefreshCw size={12} />
                <span>{dataSource === 'db' ? 'SHOW LIVE' : 'SHOW AI GRAPH'}</span>
              </button>
            </div>

            {/* Filters Panel */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="absolute left-6 top-72 hud-panel hud-bracket p-5 w-64 space-y-5"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-mono-tech text-[#D4AF37]">FILTERS</p>
                    <button onClick={() => setShowFilters(false)} className="text-[#F9F8F6]/40 hover:text-[#F9F8F6]">
                      <X size={12} />
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#F9F8F6]/60 flex items-center gap-2">
                        <Calendar size={12} /> TIME RANGE
                      </span>
                      <span className="text-[#D4AF37] font-mono-tech">{timeRange}D</span>
                    </div>
                    <input
                      type="range"
                      value={timeRange}
                      onChange={(e) => setTimeRange(Number(e.target.value))}
                      min={7}
                      max={90}
                      step={7}
                      className="w-full accent-[#D4AF37] h-1 bg-[#D4AF37]/20"
                      data-testid="time-range-slider"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#F9F8F6]/60 flex items-center gap-2">
                        <Eye size={12} /> MIN FREQUENCY
                      </span>
                      <span className="text-[#D4AF37] font-mono-tech">{minFrequency}</span>
                    </div>
                    <input
                      type="range"
                      value={minFrequency}
                      onChange={(e) => setMinFrequency(Number(e.target.value))}
                      min={1}
                      max={10}
                      step={1}
                      className="w-full accent-[#D4AF37] h-1 bg-[#D4AF37]/20"
                      data-testid="min-frequency-slider"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Selected Node Details - Minimalistic */}
            <AnimatePresence>
              {selectedNode && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.3 }}
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 hud-panel p-5"
                  style={{ minWidth: '280px' }}
                  data-testid="selected-node-details"
                >
                  <div className="flex items-center justify-between gap-8">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ 
                          backgroundColor: getNodeColor(selectedNode.type),
                          boxShadow: `0 0 12px ${getNodeColor(selectedNode.type)}`
                        }}
                      />
                      <div>
                        <h3 className="font-display text-lg text-[#F9F8F6]">{selectedNode.label}</h3>
                        <p className="font-mono-tech text-[9px] text-[#F9F8F6]/40 uppercase tracking-wider">
                          {selectedNode.type} • {graphData.links.filter(l => {
                            const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
                            const targetId = typeof l.target === 'object' ? l.target.id : l.target;
                            return sourceId === selectedNode.id || targetId === selectedNode.id;
                          }).length} connections
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => { setSelectedNode(null); setFocusMode(false); }} 
                      className="text-[#F9F8F6]/30 hover:text-[#F9F8F6] transition-colors p-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </AppLayout>
  );
}

// Full-screen Loading Animation
function FullScreenLoader({ message, isDark }) {
  return (
    <div className={`absolute inset-0 flex items-center justify-center ${isDark ? 'bg-[#030303]' : 'bg-[#F9F8F6]'}`}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="text-center"
      >
        <div className="relative w-48 h-48 mx-auto mb-12">
          {/* Rotating outer ring */}
          <motion.div
            className="absolute inset-0 border border-[#D4AF37]/30"
            style={{ borderRadius: '50%' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
          
          {/* Counter-rotating inner ring */}
          <motion.div
            className="absolute inset-6 border border-[#D4AF37]/20"
            style={{ borderRadius: '50%' }}
            animate={{ rotate: -360 }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          />
          
          {/* Pulsing nodes */}
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-[#D4AF37]"
              style={{
                left: `calc(50% + ${70 * Math.cos(2 * Math.PI * i / 8)}px - 4px)`,
                top: `calc(50% + ${70 * Math.sin(2 * Math.PI * i / 8)}px - 4px)`,
              }}
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.3, 1, 0.3],
                boxShadow: ['0 0 4px #D4AF37', '0 0 16px #D4AF37', '0 0 4px #D4AF37'],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
          
          {/* Center pulse */}
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-[#D4AF37]"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
        
        <motion.p
          className={`font-mono-tech text-[11px] uppercase tracking-[0.3em] ${isDark ? 'text-[#F9F8F6]/50' : 'text-[#1A1A1A]/50'}`}
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {message}
        </motion.p>
      </motion.div>
    </div>
  );
}

// Generating Animation
function GeneratingAnimation({ isDark }) {
  const stages = [
    "Scanning browsing history",
    "Extracting named entities",
    "Analyzing conceptual patterns",
    "Building semantic relationships",
    "Constructing knowledge graph"
  ];
  const [currentStage, setCurrentStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStage(prev => (prev + 1) % stages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`absolute inset-0 flex items-center justify-center ${isDark ? 'bg-[#030303]' : 'bg-[#F9F8F6]'}`}>
      {isDark && (
        <>
          <div className="graph-starfield" />
          <div className="graph-grid" />
          <div className="graph-scanline" />
        </>
      )}
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center max-w-lg px-8 relative z-10"
      >
        {/* Neural network animation */}
        <div className="relative w-72 h-72 mx-auto mb-16">
          {[...Array(12)].map((_, i) => {
            const angle = (2 * Math.PI * i) / 12;
            const radius = 120;
            return (
              <motion.div
                key={i}
                className="absolute w-3 h-3"
                style={{
                  left: `calc(50% + ${radius * Math.cos(angle)}px - 6px)`,
                  top: `calc(50% + ${radius * Math.sin(angle)}px - 6px)`,
                  backgroundColor: i % 3 === 0 ? '#D4AF37' : i % 3 === 1 ? '#4A9EFF' : '#9B59B6',
                  boxShadow: `0 0 12px ${i % 3 === 0 ? '#D4AF37' : i % 3 === 1 ? '#4A9EFF' : '#9B59B6'}`,
                }}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.3, 1, 0.3],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.12,
                }}
              />
            );
          })}
          
          {/* Central orb */}
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-[#D4AF37]"
            style={{ borderRadius: '50%' }}
            animate={{
              scale: [1, 1.3, 1],
              boxShadow: [
                '0 0 30px rgba(212, 175, 55, 0.3)',
                '0 0 80px rgba(212, 175, 55, 0.6)',
                '0 0 30px rgba(212, 175, 55, 0.3)'
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
        
        {/* Stage indicator */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <p className="font-mono-tech text-[10px] text-[#D4AF37]">
              STEP {currentStage + 1} / {stages.length}
            </p>
            <p className={`text-sm font-light ${isDark ? 'text-[#F9F8F6]/70' : 'text-[#1A1A1A]/70'}`}>
              {stages[currentStage]}
            </p>
          </motion.div>
        </AnimatePresence>
        
        {/* Progress dots */}
        <div className="flex justify-center gap-3 mt-10">
          {stages.map((_, i) => (
            <motion.div
              key={i}
              className={`w-2 h-2 ${i === currentStage ? 'bg-[#D4AF37]' : isDark ? 'bg-[#F9F8F6]/20' : 'bg-[#1A1A1A]/20'}`}
              animate={i === currentStage ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// Empty State
function EmptyGraphState({ onGenerate, isDark }) {
  return (
    <div className={`absolute inset-0 flex items-center justify-center ${isDark ? 'bg-[#030303]' : 'bg-[#F9F8F6]'}`}>
      {isDark && (
        <>
          <div className="graph-starfield" />
          <div className="graph-grid" />
          <div className="graph-vignette" />
        </>
      )}
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md px-8 relative z-10"
      >
        <motion.div 
          className="w-px h-16 bg-[#D4AF37] mx-auto mb-10"
          animate={{ scaleY: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        
        <h2 className={`font-display text-4xl mb-5 ${isDark ? 'text-[#F9F8F6]' : 'text-[#1A1A1A]'}`}>
          Your cosmos <em className="text-[#D4AF37]">awaits</em>
        </h2>
        
        <p className={`text-sm font-light leading-relaxed mb-10 ${isDark ? 'text-[#F9F8F6]/45' : 'text-[#1A1A1A]/45'}`}>
          As you explore the web with Sense, your intellectual universe will emerge—a living constellation of curiosity and discovery.
        </p>
        
        <Button
          onClick={onGenerate}
          data-testid="empty-generate-button"
          className="hud-panel hud-bracket bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/40 hover:border-[#D4AF37] px-10 py-4 uppercase tracking-[0.2em] text-xs font-medium transition-all duration-500 flex items-center gap-3 mx-auto"
        >
          <Sparkles size={16} />
          <span>Initialize Graph</span>
        </Button>
        
        <p className={`font-mono-tech text-[9px] uppercase tracking-[0.2em] mt-8 ${isDark ? 'text-[#F9F8F6]/25' : 'text-[#1A1A1A]/25'}`}>
          Requires browsing data from Sense extension
        </p>
      </motion.div>
    </div>
  );
}
