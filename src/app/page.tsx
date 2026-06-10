'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  Panel,
  Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Database, Search, ChevronRight, ChevronLeft, ArrowRight, ArrowLeft } from 'lucide-react';
import TableNode, { TableNodeData } from '@/components/TableNode';
import clsx from 'clsx';

const nodeTypes = {
  tableNode: TableNode,
};

function getConcentricLayout(nodes: any[], edges: any[]) {
  const degree: Record<string, number> = {};
  nodes.forEach(n => degree[n.id] = 0);
  edges.forEach(e => {
    if(degree[e.source] !== undefined) degree[e.source]++;
    if(degree[e.target] !== undefined) degree[e.target]++;
  });
  
  const sorted = [...nodes].sort((a,b) => degree[b.id] - degree[a.id]);
  
  let radius = 0;
  let angle = 0;
  let currentRingCapacity = 1;
  let itemsInRing = 0;
  
  sorted.forEach((n, i) => {
    if (i === 0) {
      n.position = { x: 0, y: 0 };
    } else {
      if (itemsInRing >= currentRingCapacity) {
        radius += 500; // Espaçamento entre anéis
        currentRingCapacity = Math.max(8, Math.floor((2 * Math.PI * radius) / 350)); 
        itemsInRing = 0;
        angle = 0;
      }
      const angleStep = (2 * Math.PI) / currentRingCapacity;
      n.position = {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      };
      angle += angleStep;
      itemsInRing++;
    }
  });
  return sorted;
}

function getHierarchicalLayout(rootNodeId: string, allNodes: any[], allEdges: any[]) {
  const visited = new Set<string>();
  const queue = [{ id: rootNodeId, depth: 0 }];
  const nodeLevels = new Map<string, number>();
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    
    visited.add(current.id);
    nodeLevels.set(current.id, current.depth);
    
    // Find neighbors (only outgoing or incoming, we want all connections)
    const neighbors = new Set<string>();
    allEdges.forEach(e => {
      if (e.source === current.id && !visited.has(e.target)) neighbors.add(e.target);
      if (e.target === current.id && !visited.has(e.source)) neighbors.add(e.source);
    });
    
    neighbors.forEach(nId => {
      queue.push({ id: nId, depth: current.depth + 1 });
    });
  }

  // Group nodes by depth
  const nodesByDepth: Record<number, any[]> = {};
  allNodes.forEach(node => {
    if (!visited.has(node.id)) return;
    const d = nodeLevels.get(node.id)!;
    if (!nodesByDepth[d]) nodesByDepth[d] = [];
    nodesByDepth[d].push(node);
  });
  
  return allNodes.map(node => {
    if (!visited.has(node.id)) {
      return { ...node, hidden: true };
    }
    
    const depth = nodeLevels.get(node.id)!;
    const levelNodes = nodesByDepth[depth];
    const indexInLevel = levelNodes.indexOf(node);
    
    const totalHeight = levelNodes.length * 350;
    const startY = -(totalHeight / 2) + 175;
    
    const x = depth * 600; // Espaçamento horizontal entre colunas
    const y = startY + indexInLevel * 350;
    
    return { ...node, hidden: false, position: { x, y }, style: { ...node.style, opacity: 1 }, data: { ...node.data, isFocused: true } };
  });
}

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [form, setForm] = useState({
    server: 'localhost',
    database: '',
    user: 'sa',
    password: '',
    api: ''
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const [allOriginalEdges, setAllOriginalEdges] = useState<Edge[]>([]);
  const [allOriginalNodes, setAllOriginalNodes] = useState<any[]>([]);

  // Carregar do Banco
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    
    try {
      const res = await fetch('/api/schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      
      if (data.status === 'success') {
        let newNodes = data.tables.map((t: any) => ({
          id: t.name,
          type: 'tableNode',
          data: {
            name: t.name,
            columns: data.columns[t.name] || [],
            primaryKeys: data.primary_keys[t.name] || [],
            isFocused: false
          },
          position: { x: 0, y: 0 }
        }));
        
        let newEdges = (data.foreign_keys || []).map((fk: any, idx: number) => ({
          id: `e-${fk.table}-${fk.ref_table}-${idx}`,
          source: fk.table,
          target: fk.ref_table,
          animated: false,
          label: `${fk.column} → ${fk.ref_column}`,
          style: { stroke: '#475569', strokeWidth: 2, opacity: 0.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' },
          data: fk // store original fk info
        }));

        // Layout inicial Concêntrico
        newNodes = getConcentricLayout(newNodes, newEdges);
        
        setNodes(newNodes);
        setEdges(newEdges);
        setAllOriginalEdges(newEdges);
        setAllOriginalNodes(newNodes);
      } else {
        setErrorMsg(data.message);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro de conexão');
    } finally {
      setIsLoading(false);
    }
  };

  // Highlighting Logic
  const handleNodeClick = useCallback((event: any, node: any) => {
    setSelectedTable(node.id);
    
    // Aplicar o Layout Hierárquico a partir da tabela clicada
    setNodes(() => {
      return getHierarchicalLayout(node.id, allOriginalNodes, allOriginalEdges);
    });
    
    // Ocultar as arestas de nós que não estão visíveis
    setEdges(eds => eds.map(e => {
      // Destacar arestas ligadas diretamente ao nó raiz
      if (e.source === node.id || e.target === node.id) {
        return { ...e, hidden: false, style: { stroke: '#3b82f6', strokeWidth: 3, opacity: 1 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }, animated: true };
      }
      return { ...e, hidden: false, style: { stroke: '#334155', strokeWidth: 1, opacity: 0.1 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#334155' }, animated: false };
    }));
  }, [allOriginalEdges, allOriginalNodes, setNodes, setEdges]);

  const handlePaneClick = useCallback(() => {
    setSelectedTable(null);
    setNodes(allOriginalNodes.map(n => ({ ...n, hidden: false, style: { ...n.style, opacity: 1 }, data: { ...n.data, isFocused: false } })));
    setEdges(allOriginalEdges);
  }, [allOriginalEdges, allOriginalNodes, setNodes, setEdges]);

  // Search Logic
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    const found = nodes.find(n => n.id.toLowerCase().includes(term.toLowerCase()));
    if (found && term.length > 2) {
      handleNodeClick(null, found);
      // Focar a tela seria ideal, mas React Flow Viewport requer um hook interno useReactFlow()
      // Como estamos no componente raiz, não podemos usar useReactFlow diretamente sem um provider.
      // Para manter simples, o clique/highlight já ajuda muito.
    } else if (!term) {
      handlePaneClick();
    }
  };

  // Calcula Relacionamentos da Tabela Selecionada
  const relationships = useMemo(() => {
    if (!selectedTable) return { exports: [], imports: [] };
    
    const exports: any[] = [];
    const imports: any[] = [];
    
    allOriginalEdges.forEach(e => {
      if (e.source === selectedTable) exports.push(e.data); // FK table -> Ref table
      if (e.target === selectedTable) imports.push(e.data); // FK ref_table <- Table
    });
    
    return { exports, imports };
  }, [selectedTable, allOriginalEdges]);

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      
      {/* SIDEBAR ESQUERDA */}
      <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col z-10 shadow-2xl">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-blue-400 flex items-center gap-2">
            <Database className="w-6 h-6" /> DER Next.js
          </h1>
          <p className="text-xs text-slate-500 mt-1">Docker Edition</p>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto">
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Server</label>
              <input required value={form.server} onChange={e=>setForm({...form, server: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Database</label>
              <input required value={form.database} onChange={e=>setForm({...form, database: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">User</label>
              <input required value={form.user} onChange={e=>setForm({...form, user: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Password</label>
              <input required type="password" value={form.password} onChange={e=>setForm({...form, password: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">DW_API Key</label>
              <input required type="password" value={form.api} onChange={e=>setForm({...form, api: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
            
            <button disabled={isLoading} type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50">
              {isLoading ? 'Carregando...' : 'Conectar e Desenhar'}
            </button>
            
            {errorMsg && <p className="text-red-400 text-xs mt-2">{errorMsg}</p>}
          </form>

          <hr className="border-slate-800 my-6" />

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1"><Search className="w-3 h-3"/> Buscar Tabela</label>
            <input value={searchTerm} onChange={e=>handleSearch(e.target.value)} placeholder="Ex: pessoa" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
        </div>
      </aside>

      {/* ÁREA CENTRAL */}
      <main className="flex-1 relative bg-slate-950">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          fitView
          minZoom={0.01}
          maxZoom={2}
          className="bg-slate-950 dark-theme-flow"
        >
          <Background color="#1e293b" gap={24} />
          
          <Controls 
            className="bg-slate-900 border-slate-800 fill-slate-300"
            style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}
          />
          
          <MiniMap 
            nodeColor="#3b82f6" 
            maskColor="rgba(15, 23, 42, 0.7)" 
            className="bg-slate-900 border border-slate-800 rounded-lg shadow-xl"
            style={{ backgroundColor: '#0f172a' }}
          />
        </ReactFlow>
      </main>

      {/* SIDEBAR DIREITA (RELACIONAMENTOS) */}
      <aside className={clsx(
        "w-96 bg-slate-900 border-l border-slate-800 flex flex-col z-10 shadow-2xl transition-transform duration-300 absolute right-0 top-0 bottom-0",
        selectedTable ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <h2 className="text-lg font-bold text-white truncate">{selectedTable}</h2>
          <button onClick={handlePaneClick} className="text-slate-400 hover:text-white"><ChevronRight /></button>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          <h3 className="text-sm font-semibold text-blue-400 mb-4 uppercase tracking-wider">Aba de Relacionamentos</h3>
          <p className="text-xs text-slate-400 mb-6">Lista de tabelas ligadas a <strong>{selectedTable}</strong> para te guiar nas consultas (JOINs).</p>
          
          <div className="space-y-6">
            
            {/* Exporta (Esta tabela tem FK apontando pra fora) */}
            <div>
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1 border-b border-slate-800 pb-2 mb-2">
                <ArrowRight className="w-3 h-3 text-emerald-400" /> Exporta (FKs desta tabela)
              </h4>
              {relationships.exports.length === 0 ? (
                <p className="text-xs text-slate-600">Nenhum relacionamento.</p>
              ) : (
                <ul className="space-y-3">
                  {relationships.exports.map((fk: any, i: number) => (
                    <li key={i} className="bg-slate-950 border border-slate-800 p-2 rounded text-xs">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-slate-400">Destino:</span>
                        <span className="font-bold text-blue-300">{fk.ref_table}</span>
                      </div>
                      <div className="bg-slate-900 p-1.5 rounded text-slate-300 font-mono text-[10px] break-all">
                        ON {fk.table}.<span className="text-emerald-400">{fk.column}</span> = {fk.ref_table}.<span className="text-emerald-400">{fk.ref_column}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Importa (Outras tabelas apontam pra cá) */}
            <div>
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1 border-b border-slate-800 pb-2 mb-2">
                <ArrowLeft className="w-3 h-3 text-amber-400" /> Importa (Outras apontam pra cá)
              </h4>
              {relationships.imports.length === 0 ? (
                <p className="text-xs text-slate-600">Nenhum relacionamento.</p>
              ) : (
                <ul className="space-y-3">
                  {relationships.imports.map((fk: any, i: number) => (
                    <li key={i} className="bg-slate-950 border border-slate-800 p-2 rounded text-xs">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-slate-400">Origem:</span>
                        <span className="font-bold text-purple-300">{fk.table}</span>
                      </div>
                      <div className="bg-slate-900 p-1.5 rounded text-slate-300 font-mono text-[10px] break-all">
                        ON {fk.table}.<span className="text-amber-400">{fk.column}</span> = {fk.ref_table}.<span className="text-amber-400">{fk.ref_column}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

          </div>
        </div>
      </aside>
    </div>
  );
}
