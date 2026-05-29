"use client";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from 'react-leaflet';

export default function MapComponent({ searchQuery, activeFlows }) {
    // Centro de Cáceres, MT
    const caceresCenter: [number, number] = [-16.0711, -57.6806];
    
    // Mapeamento geográfico da topologia (Posições reais em Cáceres - MT)
    const geoNodes = [
      // DataCenter Core: Prefeitura Municipal de Cáceres
      { id: 'server', lat: -16.0740, lng: -57.6820, name: 'DataCenter (Prefeitura)', type: 'server', ip: '10.1.1.1' },
      
      // Zona Sul - Controle de Tráfego e Radares (Avenida São Luiz / BR-070)
      { id: 'g1', lat: -16.0850, lng: -57.6920, name: 'GTW-South (Avenida)', type: 'gateway', ip: '192.168.1.1' },
      { id: 't1', lat: -16.0845, lng: -57.6930, name: 'Radar Câmera 01', type: 'sensor', ip: '192.168.1.2' },
      { id: 't2', lat: -16.0860, lng: -57.6910, name: 'Radar Semáforo 02', type: 'sensor', ip: '192.168.1.3' },
      { id: 't3', lat: -16.0875, lng: -57.6900, name: 'Radar Via 03', type: 'sensor', ip: '192.168.1.4' },
      
      // Zona Centro/Norte - Qualidade do Ar e CO2 (Praça Barão do Rio Branco e Centro Histórico)
      { id: 'g2', lat: -16.0710, lng: -57.6800, name: 'GTW-North (Praça Central)', type: 'gateway', ip: '192.168.2.1' },
      { id: 'a1', lat: -16.0715, lng: -57.6810, name: 'CO2 Sensor (Beira Rio)', type: 'sensor', ip: '192.168.2.2' },
      { id: 'a2', lat: -16.0705, lng: -57.6795, name: 'CO2 Sensor (Catedral)', type: 'sensor', ip: '192.168.2.3' },
      { id: 'a3', lat: -16.0720, lng: -57.6780, name: 'CO2 Sensor (Comércio)', type: 'sensor', ip: '192.168.2.4' },

      // Zona Leste - Gestão de Resíduos e Lixeiras (Bairro Cavalhada / Residencial)
      { id: 'g3', lat: -16.0600, lng: -57.6650, name: 'GTW-East (Cavalhada)', type: 'gateway', ip: '192.168.3.1' },
      { id: 'w1', lat: -16.0590, lng: -57.6640, name: 'Lixeira Inteligente 01', type: 'sensor', ip: '192.168.3.2' },
      { id: 'w2', lat: -16.0610, lng: -57.6660, name: 'Lixeira Inteligente 02', type: 'sensor', ip: '192.168.3.3' },
      { id: 'w3', lat: -16.0605, lng: -57.6630, name: 'Lixeira Inteligente 03', type: 'sensor', ip: '192.168.3.4' },
    ];

    const edges = [
        ['server', 'g1'], ['server', 'g2'], ['server', 'g3'],
        ['g1', 't1'], ['g1', 't2'], ['g1', 't3'],
        ['g2', 'a1'], ['g2', 'a2'], ['g2', 'a3'],
        ['g3', 'w1'], ['g3', 'w2'], ['g3', 'w3'],
    ];

    // Cor do nó baseado no tipo
    const getColor = (type: string) => {
        if (type === 'server') return '#3b82f6';
        if (type === 'gateway') return '#10b981';
        return '#64748b';
    };

    return (
        <MapContainer center={caceresCenter} zoom={13} style={{ height: '100%', width: '100%', background: '#0b1120' }}>
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            />
            
            {/* Desenhar links */}
            {edges.map((edge, i) => {
                const source = geoNodes.find(n => n.id === edge[0]);
                const target = geoNodes.find(n => n.id === edge[1]);
                if (!source || !target) return null;
                
                // Checa se tem pacote fluindo agora neste link (visualização do tráfego)
                const hasFlow = activeFlows?.some((f: any) => f.src === target.ip);
                
                return (
                    <Polyline 
                        key={i} 
                        positions={[[source.lat, source.lng], [target.lat, target.lng]]} 
                        color={hasFlow ? '#10b981' : '#334155'} 
                        weight={hasFlow ? 3 : 1.5}
                        dashArray={hasFlow ? "5, 5" : undefined}
                    />
                );
            })}

            {/* Desenhar nós */}
            {geoNodes.map(node => {
                const isMatch = !searchQuery || node.name.toLowerCase().includes(searchQuery.toLowerCase()) || node.id.includes(searchQuery.toLowerCase());
                const flowData = activeFlows?.find((f: any) => f.src === node.ip);
                
                return (
                    <CircleMarker 
                        key={node.id}
                        center={[node.lat, node.lng]} 
                        radius={node.type === 'server' ? 12 : node.type === 'gateway' ? 8 : 5}
                        fillColor={getColor(node.type)}
                        color={isMatch ? '#fff' : '#333'}
                        weight={isMatch ? 2 : 1}
                        fillOpacity={isMatch ? 0.9 : 0.3}
                    >
                        <Popup className="bg-slate-900 border-slate-700 text-slate-200">
                            <div className="font-bold text-sm mb-1">{node.name}</div>
                            <div className="text-xs text-slate-400">Tipo: {node.type.toUpperCase()}</div>
                            <div className="text-xs text-slate-400">IPv4: {node.ip}</div>
                            {flowData && (
                                <div className="mt-2 border-t border-slate-700 pt-2 text-xs">
                                    <div className="text-emerald-400">Tx: {flowData.kbps.toFixed(2)} kbps</div>
                                    <div className="text-purple-400">Delay: {flowData.delay_ms.toFixed(1)} ms</div>
                                    <div className="text-blue-400">Pacotes: {flowData.rx}</div>
                                </div>
                            )}
                        </Popup>
                    </CircleMarker>
                )
            })}
        </MapContainer>
    );
}
