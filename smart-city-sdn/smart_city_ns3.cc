#include "ns3/core-module.h"
#include "ns3/network-module.h"
#include "ns3/internet-module.h"
#include "ns3/point-to-point-module.h"
#include "ns3/applications-module.h"
#include "ns3/flow-monitor-module.h"
#include "ns3/csma-module.h"

using namespace ns3;

NS_LOG_COMPONENT_DEFINE("SmartCitySdnNs3");

int main(int argc, char *argv[])
{
    bool limitGateway2 = false;

    CommandLine cmd(__FILE__);
    cmd.AddValue("limitGateway2", "Limit the bandwidth of Gateway 2 to simulate an issue/restriction", limitGateway2);
    cmd.Parse(argc, argv);

    Time::SetResolution(Time::NS);
    LogComponentEnable("UdpEchoClientApplication", LOG_LEVEL_INFO);
    LogComponentEnable("UdpEchoServerApplication", LOG_LEVEL_INFO);

    // --- Nodes Configuration ---
    // 3 Gateways (VNFs)
    NodeContainer gateways;
    gateways.Create(3);

    // 1 Central Server
    NodeContainer serverNode;
    serverNode.Create(1);

    // Sensor Groups (3 groups, 3 sensors each)
    NodeContainer group1Sensors; // Traffic
    group1Sensors.Create(3);
    NodeContainer group2Sensors; // Air Quality
    group2Sensors.Create(3);
    NodeContainer group3Sensors; // Waste
    group3Sensors.Create(3);

    // --- Channels Configuration ---
    // Links between Sensors and Gateways (using CSMA to simulate local LANs/switches)
    CsmaHelper csmaSensors;
    csmaSensors.SetChannelAttribute("DataRate", StringValue("100Mbps"));
    csmaSensors.SetChannelAttribute("Delay", TimeValue(NanoSeconds(6560)));

    NodeContainer g1Network; g1Network.Add(gateways.Get(0)); g1Network.Add(group1Sensors);
    NodeContainer g2Network; g2Network.Add(gateways.Get(1)); g2Network.Add(group2Sensors);
    NodeContainer g3Network; g3Network.Add(gateways.Get(2)); g3Network.Add(group3Sensors);

    NetDeviceContainer g1Devices = csmaSensors.Install(g1Network);
    NetDeviceContainer g2Devices = csmaSensors.Install(g2Network);
    NetDeviceContainer g3Devices = csmaSensors.Install(g3Network);

    // Links between Gateways and Central Server (Point-to-Point)
    PointToPointHelper p2pCore;
    p2pCore.SetDeviceAttribute("DataRate", StringValue("1Gbps"));
    p2pCore.SetChannelAttribute("Delay", StringValue("2ms"));

    PointToPointHelper p2pCoreLimited;
    if (limitGateway2) {
        // Limiting bandwidth to 500Kbps to create a bottleneck and packet loss
        p2pCoreLimited.SetDeviceAttribute("DataRate", StringValue("500Kbps"));
        p2pCoreLimited.SetChannelAttribute("Delay", StringValue("10ms"));
    } else {
        p2pCoreLimited = p2pCore;
    }

    NetDeviceContainer gw1ServerDevs = p2pCore.Install(gateways.Get(0), serverNode.Get(0));
    NetDeviceContainer gw2ServerDevs = p2pCoreLimited.Install(gateways.Get(1), serverNode.Get(0));
    NetDeviceContainer gw3ServerDevs = p2pCore.Install(gateways.Get(2), serverNode.Get(0));


    // --- Internet Stack Configuration ---
    InternetStackHelper stack;
    stack.Install(gateways);
    stack.Install(serverNode);
    stack.Install(group1Sensors);
    stack.Install(group2Sensors);
    stack.Install(group3Sensors);

    // --- IP Addressing ---
    Ipv4AddressHelper address;

    // Sensor Networks
    address.SetBase("192.168.1.0", "255.255.255.0");
    Ipv4InterfaceContainer g1Ifaces = address.Assign(g1Devices);
    
    address.SetBase("192.168.2.0", "255.255.255.0");
    Ipv4InterfaceContainer g2Ifaces = address.Assign(g2Devices);
    
    address.SetBase("192.168.3.0", "255.255.255.0");
    Ipv4InterfaceContainer g3Ifaces = address.Assign(g3Devices);

    // Core Networks (Gateway -> Server)
    address.SetBase("10.1.1.0", "255.255.255.252");
    Ipv4InterfaceContainer gw1SrvIface = address.Assign(gw1ServerDevs);

    address.SetBase("10.1.2.0", "255.255.255.252");
    Ipv4InterfaceContainer gw2SrvIface = address.Assign(gw2ServerDevs);

    address.SetBase("10.1.3.0", "255.255.255.252");
    Ipv4InterfaceContainer gw3SrvIface = address.Assign(gw3ServerDevs);

    Ipv4GlobalRoutingHelper::PopulateRoutingTables();

    // --- Applications ---
    uint16_t port = 9;

    // Server Application
    UdpEchoServerHelper server(port);
    ApplicationContainer serverApps = server.Install(serverNode.Get(0));
    serverApps.Start(Seconds(1.0));
    serverApps.Stop(Seconds(10.0));

    // Client Applications (Sensors sending data to server)
    // We will install an echo client on the first sensor of each group
    
    // Group 1 Sensor
    UdpEchoClientHelper client1(gw1SrvIface.GetAddress(1), port);
    client1.SetAttribute("MaxPackets", UintegerValue(100));
    client1.SetAttribute("Interval", TimeValue(Seconds(0.05))); // High traffic
    client1.SetAttribute("PacketSize", UintegerValue(1024));
    ApplicationContainer client1App = client1.Install(group1Sensors.Get(1));
    client1App.Start(Seconds(2.0));
    client1App.Stop(Seconds(10.0));

    // Group 2 Sensor
    UdpEchoClientHelper client2(gw2SrvIface.GetAddress(1), port);
    client2.SetAttribute("MaxPackets", UintegerValue(100));
    client2.SetAttribute("Interval", TimeValue(Seconds(0.05))); // High traffic
    client2.SetAttribute("PacketSize", UintegerValue(1024));
    ApplicationContainer client2App = client2.Install(group2Sensors.Get(1));
    client2App.Start(Seconds(2.0));
    client2App.Stop(Seconds(10.0));

    // Group 3 Sensor
    UdpEchoClientHelper client3(gw3SrvIface.GetAddress(1), port);
    client3.SetAttribute("MaxPackets", UintegerValue(100));
    client3.SetAttribute("Interval", TimeValue(Seconds(0.05))); // High traffic
    client3.SetAttribute("PacketSize", UintegerValue(1024));
    ApplicationContainer client3App = client3.Install(group3Sensors.Get(1));
    client3App.Start(Seconds(2.0));
    client3App.Stop(Seconds(10.0));


    // --- Flow Monitor (Metrics Collection) ---
    FlowMonitorHelper flowmon;
    Ptr<FlowMonitor> monitor = flowmon.InstallAll();

    // --- Run Simulation ---
    Simulator::Stop(Seconds(11.0));
    Simulator::Run();

    // --- Print Metrics ---
    monitor->CheckForLostPackets();
    Ptr<Ipv4FlowClassifier> classifier = DynamicCast<Ipv4FlowClassifier>(flowmon.GetClassifier());
    std::map<FlowId, FlowMonitor::FlowStats> stats = monitor->GetFlowStats();

    std::cout << "=========================================" << std::endl;
    std::cout << "Simulation Mode: " << (limitGateway2 ? "LIMITED GATEWAY 2" : "NORMAL") << std::endl;
    std::cout << "=========================================" << std::endl;

    for (std::map<FlowId, FlowMonitor::FlowStats>::const_iterator i = stats.begin(); i != stats.end(); ++i) {
        // Filter to only show traffic going to the server ports
        Ipv4FlowClassifier::FiveTuple t = classifier->FindFlow(i->first);
        if (t.destinationPort == port) {
            std::cout << "Flow " << i->first << " (" << t.sourceAddress << " -> " << t.destinationAddress << ")" << std::endl;
            std::cout << "  Tx Packets:   " << i->second.txPackets << std::endl;
            std::cout << "  Rx Packets:   " << i->second.rxPackets << std::endl;
            std::cout << "  Lost Packets: " << i->second.lostPackets << std::endl;
            
            double throughput = i->second.rxBytes * 8.0 / (i->second.timeLastRxPacket.GetSeconds() - i->second.timeFirstTxPacket.GetSeconds()) / 1024 / 1024;
            if (i->second.rxPackets > 0) {
                 std::cout << "  Throughput:   " << throughput << " Mbps" << std::endl;
                 std::cout << "  Mean Delay:   " << i->second.delaySum.GetSeconds() / i->second.rxPackets << " s" << std::endl;
                 std::cout << "  Mean Jitter:  " << i->second.jitterSum.GetSeconds() / (i->second.rxPackets - 1) << " s" << std::endl;
            } else {
                 std::cout << "  Throughput:   0 Mbps" << std::endl;
                 std::cout << "  Mean Delay:   N/A" << std::endl;
            }
            std::cout << "-----------------------------------------" << std::endl;
        }
    }

    Simulator::Destroy();
    return 0;
}
