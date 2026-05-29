# Smart City SDN/NFV Project Validation Guide

Este guia detalha como executar a validação operacional ao vivo no Mininet e como executar a simulação de desempenho no NS-3, conforme os requisitos do projeto.

## Parte 1: Validação Operacional (Apresentação Mininet)

### Passo 1: Iniciar o Ambiente
1. Inicie a infraestrutura Docker em um terminal:
   ```bash
   docker-compose up -d
   ```
2. Acesse o container do Mininet para iniciar a topologia interativa:
   ```bash
   docker exec -it mininet_core bash -c "service openvswitch-switch start && python3 /root/smart_city_mininet.py"
   ```
   *(Aguarde o prompt `mininet>` aparecer)*

### Passo 2: Controlador SDN e Comunicação
1. No prompt do Mininet, teste a comunicação entre os sensores e o servidor:
   ```text
   mininet> pingall
   ```
   *Isso demonstrará o controlador Ryu instalando os fluxos dinamicamente para permitir a comunicação.*
2. Faça um ping específico de um sensor para o servidor para mostrar conectividade fim-a-fim:
   ```text
   mininet> t1 ping -c 3 server
   ```

### Passo 3: Exibição de Tabela de Fluxos
1. No prompt do Mininet, ou em outro terminal executando `docker exec -it mininet_core bash`, verifique as regras OpenFlow no switch de borda `s1` (Switch de Tráfego):
   ```bash
   ovs-ofctl dump-flows s1 -O OpenFlow13
   ```
   *Você verá os fluxos instalados pelo controlador Ryu.*

### Passo 4: Funcionamento das VNFs (Gateways)
1. Abra um terminal interativo no gateway `g1` (VNF de Tráfego) através do Mininet:
   ```text
   mininet> xterm g1
   ```
   *Ou execute um comando diretamente no gateway:*
   ```text
   mininet> g1 iptables -L
   ```
   *Isso mostrará a regra de encaminhamento (`FORWARD -j ACCEPT`) atuando como NFV.*

### Passo 5: Alteração de Comportamento (Bloqueio de Tráfego via VNF)
Vamos bloquear o tráfego do grupo de sensores de Qualidade do Ar (`192.168.2.0/24`) aplicando uma regra no seu respectivo gateway (`g2`).

1. Primeiro, verifique que o tráfego está fluindo:
   ```text
   mininet> a1 ping -c 3 server
   ```
2. Aplique a regra de bloqueio (Drop) no gateway `g2`:
   ```text
   mininet> g2 iptables -I FORWARD -s 192.168.2.0/24 -j DROP
   ```
3. Teste novamente (o ping deve falhar, demonstrando o bloqueio):
   ```text
   mininet> a1 ping -c 3 server
   ```
4. Para restaurar:
   ```text
   mininet> g2 iptables -D FORWARD -s 192.168.2.0/24 -j DROP
   ```

---

## Parte 2: Simulação no NS-3

Foi criado um script NS-3 (`smart_city_ns3.cc`) que reflete a mesma topologia lógica do Mininet (3 grupos -> 3 gateways -> 1 servidor). Ele utiliza aplicações UDP Echo para gerar tráfego e o FlowMonitor para coletar as métricas exigidas.

### Como Executar a Simulação

O script permite executar um cenário normal e um cenário com limitação de tráfego, controlado via parâmetro de linha de comando.

1.  **Copie o script para o diretório `scratch` do NS-3:**
    *(Assumindo que você tem o NS-3 instalado em algum diretório, ex: `~/ns-3-dev`)*
    ```bash
    cp smart_city_ns3.cc ~/ns-3-dev/scratch/
    cd ~/ns-3-dev
    ```

2.  **Cenário Normal:**
    Execute a simulação sem limitações:
    ```bash
    ./ns3 run "scratch/smart_city_ns3"
    ```
    *A simulação imprimirá métricas como Throughput, Delay e Packet Loss para os fluxos.*

3.  **Cenário com Limitação:**
    Vamos simular um estrangulamento na largura de banda do link entre o Gateway 2 e o Servidor, o que forçará perda de pacotes e aumento de atraso.
    ```bash
    ./ns3 run "scratch/smart_city_ns3 --limitGateway2=true"
    ```

### Comparação de Resultados
Anote os resultados exibidos no terminal (Throughput, Rx Packets, Tx Packets, Delay) nos dois cenários para apresentar a comparação solicitada nos requisitos do projeto. Você verá uma clara degradação no desempenho (queda de throughput e aumento de loss/delay) no cenário limitado.
