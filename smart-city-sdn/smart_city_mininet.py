#!/usr/bin/env python3
from mininet.net import Mininet
from mininet.node import RemoteController, OVSKernelSwitch, Node
from mininet.cli import CLI
from mininet.log import setLogLevel, info
import time

class LinuxRouter(Node):
    """Um Host Mininet atuando como VNF (Gateway) com IP Forwarding e iptables."""
    def config(self, **params):
        super(LinuxRouter, self).config(**params)
        self.cmd('sysctl net.ipv4.ip_forward=1')
        # Aqui você pode mostrar na apresentação que este nó tem iptables:
        self.cmd('iptables -A FORWARD -j ACCEPT')

    def terminate(self):
        self.cmd('sysctl net.ipv4.ip_forward=0')
        super(LinuxRouter, self).terminate()

def run_topology():
    net = Mininet(controller=RemoteController, switch=OVSKernelSwitch)
    
    info('*** Adicionando Controlador SDN Externo (Ryu via Docker)\n')
    c0 = net.addController('c0', controller=RemoteController, ip='sdn_controller', port=6653)
    
    info('*** Adicionando Switches OpenFlow (OVS)\n')
    s1 = net.addSwitch('s1', protocols='OpenFlow13') # Switch Traffic
    s2 = net.addSwitch('s2', protocols='OpenFlow13') # Switch Air
    s3 = net.addSwitch('s3', protocols='OpenFlow13') # Switch Waste
    s4 = net.addSwitch('s4', protocols='OpenFlow13') # Switch Core

    info('*** Adicionando VNFs (Gateways com Iptables)\n')
    g1 = net.addHost('g1', cls=LinuxRouter, ip='192.168.1.1/24')
    g2 = net.addHost('g2', cls=LinuxRouter, ip='192.168.2.1/24')
    g3 = net.addHost('g3', cls=LinuxRouter, ip='192.168.3.1/24')

    info('*** Adicionando DataCenter Server\n')
    server = net.addHost('server', ip='10.1.1.1/24', defaultRoute='via 10.1.1.254')

    info('*** Adicionando 3 Grupos de Sensores (3 de cada)\n')
    t1 = net.addHost('t1', ip='192.168.1.2/24', defaultRoute='via 192.168.1.1')
    t2 = net.addHost('t2', ip='192.168.1.3/24', defaultRoute='via 192.168.1.1')
    t3 = net.addHost('t3', ip='192.168.1.4/24', defaultRoute='via 192.168.1.1')

    a1 = net.addHost('a1', ip='192.168.2.2/24', defaultRoute='via 192.168.2.1')
    a2 = net.addHost('a2', ip='192.168.2.3/24', defaultRoute='via 192.168.2.1')
    a3 = net.addHost('a3', ip='192.168.2.4/24', defaultRoute='via 192.168.2.1')

    w1 = net.addHost('w1', ip='192.168.3.2/24', defaultRoute='via 192.168.3.1')
    w2 = net.addHost('w2', ip='192.168.3.3/24', defaultRoute='via 192.168.3.1')
    w3 = net.addHost('w3', ip='192.168.3.4/24', defaultRoute='via 192.168.3.1')

    info('*** Conectando Links\n')
    # Sensores -> Switch da Borda
    net.addLink(t1, s1); net.addLink(t2, s1); net.addLink(t3, s1)
    net.addLink(a1, s2); net.addLink(a2, s2); net.addLink(a3, s2)
    net.addLink(w1, s3); net.addLink(w2, s3); net.addLink(w3, s3)

    # Switch da Borda -> Gateways (VNFs)
    net.addLink(s1, g1, intfName2='g1-eth0')
    net.addLink(s2, g2, intfName2='g2-eth0')
    net.addLink(s3, g3, intfName2='g3-eth0')

    # Gateways (VNFs) -> Switch Core
    net.addLink(g1, s4, intfName1='g1-eth1', params1={'ip': '10.1.1.11/24'})
    net.addLink(g2, s4, intfName1='g2-eth1', params1={'ip': '10.1.1.12/24'})
    net.addLink(g3, s4, intfName1='g3-eth1', params1={'ip': '10.1.1.13/24'})

    # Switch Core -> DataCenter Server
    net.addLink(s4, server)

    info('*** Iniciando a Rede Mininet-SDN\n')
    net.start()

    info('*** Adicionando Rotas do Servidor para alcançar as sub-redes CSMA\n')
    server.cmd('ip route add 192.168.1.0/24 via 10.1.1.11')
    server.cmd('ip route add 192.168.2.0/24 via 10.1.1.12')
    server.cmd('ip route add 192.168.3.0/24 via 10.1.1.13')

    info('\n*** AMBIENTE PRONTO PARA AVALIAÇÃO ***\n')
    info('Teste os fluxos abrindo terminais (xterm g1 server) ou rodando comandos.\n')
    info('Para mostrar fluxos OVS: ovs-ofctl dump-flows s1 -O OpenFlow13\n')
    info('Para testar VNFs: no terminal de um Gateway (g1), rode iptables -L\n')
    
    CLI(net)
    net.stop()

if __name__ == '__main__':
    setLogLevel('info')
    run_topology()
