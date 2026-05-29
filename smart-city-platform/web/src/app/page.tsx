"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import mqtt from "mqtt";
import ReactFlow, { Background, Controls, Edge, Node, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange, MarkerType } from 'reactflow';
import { Search, Server, Wifi, Activity, Play, Pause, Plus, LayoutDashboard, Settings, Map as MapIcon, Terminal, ActivitySquare, ListFilter, StopCircle } from "lucide-react";
import dynamic from "next/dynamic";

const MapComponent = dynamic(() => import("../components/MapComponent"), { ssr: false });

const nodeBase = {
  background: '#1e293b',
  color: '#f8fafc',
  border: '1px solid #334155',
  borderRadius: '6px',
  boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.3)',
  fontSize: '12px',
  fontFamily: 'Inter, system-ui, sans-serif',
};

const initialNodes: Node[] = [
  { id: 'server', position: { x: 400, y: 50 }, data: { label: 'DataCenter Core' }, style: { ...nodeBase, borderTop: '3px solid #3b82f6', fontWeight: 600, width: 140, textAlign: 'center' } },
  { id: 'g1', position: { x: 150, y: 150 }, data: { label: 'GTW-South (Traffic)' }, style: { ...nodeBase, borderTop: '3px solid #10b981', width: 140, textAlign: 'center' } },
  { id: 'g2', position: { x: 400, y: 150 }, data: { label: 'GTW-North (Air)' }, style: { ...nodeBase, borderTop: '3px solid #10b981', width: 140, textAlign: 'center' } },
  { id: 'g3', position: { x: 650, y: 150 }, data: { label: 'GTW-East (Waste)' }, style: { ...nodeBase, borderTop: '3px solid #10b981', width: 140, textAlign: 'center' } },
  { id: 't1', position: { x: 50, y: 250 }, data: { label: 'RAD-01' }, style: { ...nodeBase, borderRadius: '16px' } },
  { id: 't2', position: { x: 150, y: 280 }, data: { label: 'RAD-02' }, style: { ...nodeBase, borderRadius: '16px' } },
  { id: 't3', position: { x: 250, y: 250 }, data: { label: 'RAD-03' }, style: { ...nodeBase, borderRadius: '16px' } },
  { id: 'a1', position: { x: 300, y: 250 }, data: { label: 'CO2-01' }, style: { ...nodeBase, borderRadius: '16px' } },
  { id: 'a2', position: { x: 400, y: 280 }, data: { label: 'CO2-02' }, style: { ...nodeBase, borderRadius: '16px' } },
  { id: 'a3', position: { x: 500, y: 250 }, data: { label: 'CO2-03' }, style: { ...nodeBase, borderRadius: '16px' } },
  { id: 'w1', position: { x: 550, y: 250 }, data: { label: 'WST-01' }, style: { ...nodeBase, borderRadius: '16px' } },
  { id: 'w2', position: { x: 650, y: 280 }, data: { label: 'WST-02' }, style: { ...nodeBase, borderRadius: '16px' } },
  { id: 'w3', position: { x: 750, y: 250 }, data: { label: 'WST-03' }, style: { ...nodeBase, borderRadius: '16px' } },
];

const ipLookup: Record<string, string> = {
  'server': '10.1.1.1',
  'g1': '192.168.1.1', 'g2': '192.168.2.1', 'g3': '192.168.3.1',
  't1': '192.168.1.2', 't2': '192.168.1.3', 't3': '192.168.1.4',
  'a1': '192.168.2.2', 'a2': '192.168.2.3', 'a3': '192.168.2.4',
  'w1': '192.168.3.2', 'w2': '192.168.3.3', 'w3': '192.168.3.4'
};

const defaultEdgeOptions = { style: { stroke: '#475569', strokeWidth: 1.5 }, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' } };

const initialEdges: Edge[] = [
  { id: 'e-s-g1', source: 'server', target: 'g1', ...defaultEdgeOptions, animated: true, style: { stroke: '#3b82f6', strokeWidth: 1.5 } },
  { id: 'e-s-g2', source: 'server', target: 'g2', ...defaultEdgeOptions, animated: true, style: { stroke: '#3b82f6', strokeWidth: 1.5 } },
  { id: 'e-s-g3', source: 'server', target: 'g3', ...defaultEdgeOptions, animated: true, style: { stroke: '#3b82f6', strokeWidth: 1.5 } },
  { id: 'e-g1-t1', source: 'g1', target: 't1', ...defaultEdgeOptions }, { id: 'e-g1-t2', source: 'g1', target: 't2', ...defaultEdgeOptions }, { id: 'e-g1-t3', source: 'g1', target: 't3', ...defaultEdgeOptions },
  { id: 'e-g2-a1', source: 'g2', target: 'a1', ...defaultEdgeOptions }, { id: 'e-g2-a2', source: 'g2', target: 'a2', ...defaultEdgeOptions }, { id: 'e-g2-a3', source: 'g2', target: 'a3', ...defaultEdgeOptions },
  { id: 'e-g3-w1', source: 'g3', target: 'w1', ...defaultEdgeOptions }, { id: 'e-g3-w2', source: 'g3', target: 'w2', ...defaultEdgeOptions }, { id: 'e-g3-w3', source: 'g3', target: 'w3', ...defaultEdgeOptions },
];

export default function Home() {
  const [client, setClient] = useState<mqtt.MqttClient | null>(null);
  const [status, setStatus] = useState("Desconectado");
  const [isPaused, setIsPaused] = useState(false);
  const [metrics, setMetrics] = useState({ throughput: "0.00", lost: 0, rx: 0, tx: 0, time: "0.0", delay: "0.0", jitter: "0.0" });
  
  const [simConfig, setSimConfig] = useState({
    p2pDataRate: "100Mbps",
    p2pDelay: "5ms",
    csmaDataRate: "10Mbps",
    csmaDelay: "2ms"
  });

  const [logs, setLogs] = useState<{timestamp: string, msg: string, type: 'sys'|'tel'|'cmd'|'ns3'}[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<'logical' | 'map' | 'table' | 'settings'>('settings');
  const [activeFlows, setActiveFlows] = useState<any[]>([]);
  
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  useEffect(() => {
    const mqttClient = mqtt.connect("ws://localhost:8085/mqtt");
    setClient(mqttClient);

    mqttClient.on("connect", () => {
      setStatus("Conectado");
      mqttClient.subscribe("city/telemetry/#");
    });

    mqttClient.on("message", (topic, message) => {
      const payload = message.toString();
      const ts = new Date().toLocaleTimeString();
      try {
        const data = JSON.parse(payload);
        
        if (data.sim_status) {
          setIsPaused(data.sim_status === "PAUSED");
          if (data.sim_status === "STOPPED") setActiveFlows([]);
          setLogs(p => [{timestamp: ts, msg: `Estado da simulação alterado para: ${data.sim_status}`, type: 'sys'}, ...p].slice(0, 50));
          return;
        }

        if (data.log_ns3) {
          setLogs(p => [{timestamp: ts, msg: data.log_ns3, type: 'ns3'}, ...p].slice(0, 50));
          return;
        }

        if (data.tempo_simulado) {
          setMetrics({
            throughput: data.throughput_total_kbps.toFixed(2),
            lost: data.pacotes_perdidos,
            rx: data.pacotes_recebidos,
            tx: data.pacotes_transmitidos || 0,
            time: data.tempo_simulado.toFixed(1),
            delay: data.latencia_ms.toFixed(2),
            jitter: data.jitter_ms.toFixed(2)
          });
          
          if (data.flows) {
            setActiveFlows(data.flows);
          }
        }
      } catch (e) { }
    });

    return () => mqttClient.end();
  }, []);

  const handleStartSim = () => {
    setMetrics({ throughput: "0.00", lost: 0, rx: 0, tx: 0, time: "0.0", delay: "0.0", jitter: "0.0" });
    setActiveFlows([]);
    client?.publish("city/control", JSON.stringify({ action: "START_SIM", params: simConfig }));
    setActiveTab('table');
  };

  const handleTogglePause = () => {
    client?.publish("city/control", JSON.stringify({ action: "TOGGLE_PAUSE" }));
  };

  const handleStopSim = () => {
    client?.publish("city/control", JSON.stringify({ action: "STOP_SIM" }));
  };

  const filteredLogs = useMemo(() => {
    if (!searchQuery) return logs;
    return logs.filter(l => l.msg.toLowerCase().includes(searchQuery.toLowerCase()) || l.type.includes(searchQuery.toLowerCase()));
  }, [logs, searchQuery]);

  const filteredNodes = useMemo(() => {
    if (!searchQuery) return nodes;
    return nodes.filter(n => {
      const ip = ipLookup[n.id] || '';
      return (n.data.label as string).toLowerCase().includes(searchQuery.toLowerCase()) || 
             n.id.includes(searchQuery.toLowerCase()) || 
             ip.includes(searchQuery);
    });
  }, [nodes, searchQuery]);

  const flowGraphNodes = useMemo(() => {
    return nodes.map(n => ({
      ...n,
      style: {
        ...n.style,
        opacity: filteredNodes.some(fn => fn.id === n.id) ? 1 : 0.2
      }
    }));
  }, [nodes, filteredNodes]);

  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-300 font-sans overflow-hidden selection:bg-blue-500/30">
      
      {/* Sidebar Navigation */}
      <aside className="w-16 md:w-64 border-r border-slate-800 bg-[#0b1120] flex flex-col transition-all">
        <div className="h-16 flex items-center justify-center md:justify-start md:px-6 border-b border-slate-800">
          <ActivitySquare className="w-6 h-6 text-blue-500 shrink-0" />
          <span className="ml-3 font-bold text-slate-100 hidden md:block">SmartCity OS</span>
        </div>
        <nav className="flex-1 py-6 flex flex-col gap-2 px-3">
          <button 
            onClick={() => setActiveTab('table')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${activeTab === 'table' ? 'bg-blue-500/10 text-blue-400 font-medium' : 'hover:bg-slate-800/50 text-slate-400'}`}>
            <ListFilter className="w-5 h-5 shrink-0" />
            <span className="hidden md:block">Dispositivos & Métricas</span>
          </button>
          <button 
            onClick={() => setActiveTab('logical')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${activeTab === 'logical' ? 'bg-blue-500/10 text-blue-400 font-medium' : 'hover:bg-slate-800/50 text-slate-400'}`}>
            <LayoutDashboard className="w-5 h-5 shrink-0" />
            <span className="hidden md:block">Topologia Lógica</span>
          </button>
          <button 
            onClick={() => setActiveTab('map')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${activeTab === 'map' ? 'bg-blue-500/10 text-blue-400 font-medium' : 'hover:bg-slate-800/50 text-slate-400'}`}>
            <MapIcon className="w-5 h-5 shrink-0" />
            <span className="hidden md:block">Mapa Geoespacial</span>
          </button>
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors w-full ${activeTab === 'settings' ? 'bg-blue-500/10 text-blue-400 font-medium' : 'hover:bg-slate-800/50 text-slate-400'}`}>
            <Settings className="w-5 h-5 shrink-0" />
            <span className="hidden md:block">Configurar Kernel</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Topbar */}
        <header className="h-16 border-b border-slate-800 bg-[#0f172a] flex items-center justify-between px-6 shrink-0">
          <div className="flex-1 max-w-2xl relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Pesquisa avançada: IP (ex: 192.168), Nome do Sensor, GTW..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1e293b] border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-500"
            />
          </div>
          <div className="flex items-center gap-4 ml-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                {status === 'Conectado' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-3 w-3 ${status === 'Conectado' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
              </span>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{status}</span>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-[#0b1120]">
          
          {/* Top KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 shrink-0">
            {[
              { label: 'Throughput Total', val: `${metrics.throughput} kbps`, color: 'text-emerald-400' },
              { label: 'Latência Média (Delay)', val: `${metrics.delay} ms`, color: 'text-purple-400' },
              { label: 'Jitter Médio', val: `${metrics.jitter} ms`, color: 'text-amber-400' },
              { label: 'Pacotes Transmitidos', val: metrics.tx, color: 'text-blue-400' },
              { label: 'Pacotes Recebidos', val: metrics.rx, color: 'text-blue-400' },
              { label: 'Perda de Pacotes', val: `${metrics.lost} (Loss)`, color: 'text-rose-400' },
            ].map((kpi, i) => (
              <div key={i} className="bg-[#1e293b] border border-slate-800 p-4 rounded-xl shadow-sm">
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 leading-tight min-h-[24px] flex items-center">{kpi.label}</div>
                <div className={`text-xl font-bold ${kpi.color}`}>{kpi.val}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[500px]">
            
            {/* Viz Area (Graph, Map or Table) */}
            <div className="lg:col-span-2 bg-[#1e293b] border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-sm relative">
              <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-[#0f172a]/50">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  {activeTab === 'logical' && <><Wifi className="w-4 h-4 text-blue-500" /> Topologia Lógica</>}
                  {activeTab === 'map' && <><MapIcon className="w-4 h-4 text-emerald-500" /> Cáceres-MT - SmartCity Map</>}
                  {activeTab === 'table' && <><ListFilter className="w-4 h-4 text-amber-500" /> Gestão de Dispositivos & Métricas</>}
                  {activeTab === 'settings' && <><Settings className="w-4 h-4 text-slate-400" /> Configuração do Kernel NS-3</>}
                </h3>
                <div className="flex gap-2">
                  <button onClick={handleStartSim} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 border border-blue-500 rounded-md transition-colors text-white">
                    <Play className="w-3.5 h-3.5" /> Start
                  </button>
                  <button onClick={handleTogglePause} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md transition-colors ${isPaused ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'}`}>
                    {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button onClick={handleStopSim} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-md transition-colors">
                    <StopCircle className="w-3.5 h-3.5" /> Stop
                  </button>
                </div>
              </div>
              
              <div className="flex-1 relative z-0">
                {activeTab === 'logical' && (
                  <ReactFlow 
                    nodes={flowGraphNodes} 
                    edges={edges} 
                    onNodesChange={onNodesChange} 
                    onEdgesChange={onEdgesChange} 
                    fitView
                    theme="dark"
                    proOptions={{ hideAttribution: true }}
                  >
                    <Background color="#334155" gap={24} size={1} />
                    <Controls className="bg-slate-800 fill-slate-300 border-slate-700" showInteractive={false} />
                  </ReactFlow>
                )}
                
                {activeTab === 'map' && (
                  <MapComponent searchQuery={searchQuery} activeFlows={activeFlows} />
                )}

                {activeTab === 'settings' && (
                  <div className="absolute inset-0 overflow-auto bg-[#0b1120] p-8 custom-scrollbar">
                    <p className="text-slate-400 text-sm mb-8">Defina os parâmetros de simulação física. Esses dados serão injetados diretamente na compilação do C++ pelo daemon em Python.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl">
                        <div className="space-y-5 bg-[#1e293b] p-6 rounded-xl border border-slate-800">
                            <h3 className="text-sm font-semibold text-blue-400 border-b border-slate-700 pb-3 flex items-center gap-2"><Server className="w-4 h-4"/> Backbone P2P (Servidor ⟷ Gateways)</h3>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5">Largura de Banda (DataRate)</label>
                                <input type="text" value={simConfig.p2pDataRate} onChange={e => setSimConfig({...simConfig, p2pDataRate: e.target.value})} className="w-full bg-[#0b1120] border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="Ex: 100Mbps" />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5">Atraso Físico / Distância (Delay)</label>
                                <input type="text" value={simConfig.p2pDelay} onChange={e => setSimConfig({...simConfig, p2pDelay: e.target.value})} className="w-full bg-[#0b1120] border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="Ex: 5ms" />
                            </div>
                        </div>

                        <div className="space-y-5 bg-[#1e293b] p-6 rounded-xl border border-slate-800">
                            <h3 className="text-sm font-semibold text-emerald-400 border-b border-slate-700 pb-3 flex items-center gap-2"><Wifi className="w-4 h-4"/> Borda CSMA (Gateways ⟷ Sensores)</h3>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5">Capacidade Local (DataRate)</label>
                                <input type="text" value={simConfig.csmaDataRate} onChange={e => setSimConfig({...simConfig, csmaDataRate: e.target.value})} className="w-full bg-[#0b1120] border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="Ex: 10Mbps" />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5">Latência da Borda (Delay)</label>
                                <input type="text" value={simConfig.csmaDelay} onChange={e => setSimConfig({...simConfig, csmaDelay: e.target.value})} className="w-full bg-[#0b1120] border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="Ex: 2ms" />
                            </div>
                        </div>
                    </div>

                    <div className="mt-8">
                        <button onClick={handleStartSim} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2">
                            <Play className="w-5 h-5 fill-white" /> Executar Simulação com Parâmetros Acima
                        </button>
                    </div>
                  </div>
                )}

                {activeTab === 'table' && (
                  <div className="absolute inset-0 overflow-auto bg-[#0b1120] custom-scrollbar">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-[#1e293b] text-slate-400 sticky top-0 uppercase tracking-wider font-semibold z-10 shadow-sm border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Dispositivo</th>
                          <th className="px-4 py-3">IPv4 Address</th>
                          <th className="px-4 py-3">Throughput</th>
                          <th className="px-4 py-3">Delay / Jitter</th>
                          <th className="px-4 py-3">Tx / Rx</th>
                          <th className="px-4 py-3">Loss</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {filteredNodes.length === 0 && (
                          <tr><td colSpan={7} className="text-center py-8 text-slate-500">Nenhum dispositivo encontrado na pesquisa.</td></tr>
                        )}
                        {filteredNodes.map(node => {
                          const ip = ipLookup[node.id] || 'N/A';
                          
                          let flowStats: any = null;

                          if (node.id === 'server') {
                            const totalTx = activeFlows.reduce((acc, f) => acc + f.tx, 0);
                            if (totalTx > 0) {
                              flowStats = {
                                kbps: activeFlows.reduce((acc, f) => acc + f.kbps, 0),
                                tx: totalTx,
                                rx: activeFlows.reduce((acc, f) => acc + f.rx, 0),
                                lost: activeFlows.reduce((acc, f) => acc + f.lost, 0),
                                delay_ms: activeFlows.reduce((acc, f) => acc + f.delay_ms, 0) / activeFlows.length,
                                jitter_ms: activeFlows.reduce((acc, f) => acc + (f.jitter_ms || 0), 0) / activeFlows.length,
                                isAggr: true
                              };
                            }
                          } else if (node.id.startsWith('g')) {
                            const subnet = ip.split('.').slice(0, 3).join('.');
                            const gatewayFlows = activeFlows.filter(f => f.src.startsWith(subnet) && f.src !== ip);
                            const totalTx = gatewayFlows.reduce((acc, f) => acc + f.tx, 0);
                            if (totalTx > 0) {
                              flowStats = {
                                kbps: gatewayFlows.reduce((acc, f) => acc + f.kbps, 0),
                                tx: totalTx,
                                rx: gatewayFlows.reduce((acc, f) => acc + f.rx, 0),
                                lost: gatewayFlows.reduce((acc, f) => acc + f.lost, 0),
                                delay_ms: gatewayFlows.reduce((acc, f) => acc + f.delay_ms, 0) / gatewayFlows.length,
                                jitter_ms: gatewayFlows.reduce((acc, f) => acc + (f.jitter_ms || 0), 0) / gatewayFlows.length,
                                isAggr: true
                              };
                            }
                          } else {
                            flowStats = activeFlows.find(f => f.src === ip);
                          }

                          const isActive = !!flowStats && flowStats.tx > 0;
                          
                          return (
                            <tr key={node.id} className={`hover:bg-slate-800/50 transition-colors ${flowStats?.isAggr ? 'bg-slate-800/20' : ''}`}>
                              <td className="px-4 py-3">
                                <span className={`flex h-2.5 w-2.5 rounded-full shadow-sm ${isActive ? (flowStats.isAggr ? 'bg-blue-500 shadow-[0_0_5px_#3b82f6]' : 'bg-emerald-500 shadow-[0_0_5px_#10b981]') : 'bg-slate-600'}`}></span>
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-200">
                                {node.data.label as string}
                                {flowStats?.isAggr && <span className="ml-2 text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase">Roteador</span>}
                              </td>
                              <td className="px-4 py-3 font-mono text-blue-400">{ip}</td>
                              <td className="px-4 py-3">
                                {flowStats ? <span className={flowStats.isAggr ? "text-blue-400 font-semibold" : "text-emerald-400"}>{flowStats.kbps.toFixed(2)} kbps</span> : '-'}
                              </td>
                              <td className="px-4 py-3">
                                {flowStats ? (
                                  <div className="flex flex-col gap-1">
                                    <span className="text-purple-400">{flowStats.delay_ms.toFixed(1)} ms (D)</span>
                                    <span className="text-amber-400">{(flowStats.jitter_ms || 0).toFixed(1)} ms (J)</span>
                                  </div>
                                ) : '-'}
                              </td>
                              <td className="px-4 py-3">
                                {flowStats ? (
                                  <div className="flex gap-2">
                                    <span className="text-slate-300">Tx: {flowStats.tx}</span>
                                    <span className="text-blue-400">Rx: {flowStats.rx}</span>
                                  </div>
                                ) : '-'}
                              </td>
                              <td className="px-4 py-3">
                                {flowStats ? <span className="text-rose-400">{flowStats.lost}</span> : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Logs Area */}
            <div className="bg-[#1e293b] border border-slate-800 rounded-xl flex flex-col shadow-sm overflow-hidden relative z-10">
              <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-[#0f172a]/50">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-slate-400" />
                  Stream de Eventos
                </h3>
                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">{filteredLogs.length} logs</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar bg-[#0b1120] font-mono text-[11px]">
                {filteredLogs.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                    <Search className="w-6 h-6 opacity-50" />
                    <p>Nenhum log encontrado.</p>
                  </div>
                )}
                {filteredLogs.map((log, i) => (
                  <div key={i} className="flex gap-3 hover:bg-slate-800/50 p-1.5 rounded transition-colors group">
                    <span className="text-slate-500 shrink-0 select-none">{log.timestamp}</span>
                    <span className={`
                      ${log.type === 'ns3' ? 'text-slate-300' : ''}
                      ${log.type === 'sys' ? 'text-amber-400 font-semibold' : ''}
                      ${log.type === 'cmd' ? 'text-blue-400' : ''}
                      ${log.type === 'tel' ? 'text-emerald-400/80' : ''}
                      break-all
                    `}>
                      {log.msg}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
