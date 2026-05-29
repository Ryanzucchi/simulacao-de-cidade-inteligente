import paho.mqtt.client as mqtt
import subprocess
import json
import threading
import os
import signal
import psutil
import time
import sqlite3
import sys

# Configurações
MQTT_BROKER = "localhost"
MQTT_PORT = 1883
TOPIC_CONTROL = "city/control"
TOPIC_TELEMETRY = "city/telemetry"
NS3_PATH = "/home/zucchi/Projetos/ns-3"
NS3_EXE = "/home/zucchi/Projetos/ns-3/build/scratch/ns3-dev-smart_city_final-debug"
BASE_DIR = "/home/zucchi/Projetos/ns-3/smart-city-sdn"
DB_FILE = os.path.join(BASE_DIR, "smart_city.db")
HISTORY_FILE = os.path.join(BASE_DIR, "sim_history.json")

simulation_process = None
is_paused = False
current_sim_params = None
last_valid_metrics = None

def init_db():
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS devices
                     (ip TEXT PRIMARY KEY, kbps REAL, tx INTEGER, rx INTEGER, lost INTEGER, delay_ms REAL, jitter_ms REAL, last_update TIMESTAMP)''')
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Erro DB: {e}")

def update_device_db(flow_data):
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        ts = time.time()
        for flow in flow_data:
            c.execute('''INSERT OR REPLACE INTO devices (ip, kbps, tx, rx, lost, delay_ms, jitter_ms, last_update)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                      (flow['src'], flow['kbps'], flow['tx'], flow['rx'], flow['lost'], flow['delay_ms'], flow.get('jitter_ms', 0), ts))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Erro update DB: {e}")

def save_to_history():
    global current_sim_params, last_valid_metrics
    if not current_sim_params or not last_valid_metrics:
        return
    
    print(f"Salvando histórico em {HISTORY_FILE}...")
    history = []
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, 'r') as f:
                history = json.load(f)
        except: pass
    
    entry = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "config": current_sim_params,
        "results": {
            "throughput_total_kbps": last_valid_metrics.get("throughput_total_kbps", 0),
            "pacotes_perdidos": last_valid_metrics.get("pacotes_perdidos", 0),
            "pacotes_recebidos": last_valid_metrics.get("pacotes_recebidos", 0),
            "pacotes_transmitidos": last_valid_metrics.get("pacotes_transmitidos", 0),
            "latencia_ms": last_valid_metrics.get("latencia_ms", 0),
            "jitter_ms": last_valid_metrics.get("jitter_ms", 0)
        }
    }
    history.append(entry)
    history = history[-20:]
    try:
        with open(HISTORY_FILE, 'w') as f:
            json.dump(history, f, indent=2)
    except Exception as e:
        print(f"Erro save history: {e}")

def run_ns3(params):
    global simulation_process, current_sim_params, last_valid_metrics
    current_sim_params = params
    last_valid_metrics = None
    
    cmd = [NS3_EXE]
    if params.get("limitGateway2"): cmd.append("--limitGateway2=true")
    if params.get("p2pDataRate"): cmd.append(f"--p2pDataRate={params['p2pDataRate']}")
    if params.get("p2pDelay"): cmd.append(f"--p2pDelay={params['p2pDelay']}")
    if params.get("csmaDataRate"): cmd.append(f"--csmaDataRate={params['csmaDataRate']}")
    if params.get("csmaDelay"): cmd.append(f"--csmaDelay={params['csmaDelay']}")
    
    print(f"Start NS-3: {' '.join(cmd)}")
    client.publish(TOPIC_TELEMETRY, json.dumps({"sim_status": "RUNNING"}))

    try:
        simulation_process = subprocess.Popen(cmd, cwd=NS3_PATH, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, preexec_fn=os.setsid)
        for line in iter(simulation_process.stdout.readline, ''):
            if not line: break
            line_strip = line.strip()
            if line_strip.startswith("{"):
                client.publish(f"{TOPIC_TELEMETRY}/metrics", line_strip)
                try:
                    data = json.loads(line_strip)
                    if 'flows' in data:
                        last_valid_metrics = data
                        update_device_db(data['flows'])
                except: pass
            else:
                client.publish(f"{TOPIC_TELEMETRY}/logs", json.dumps({"log_ns3": line_strip}))
        
        simulation_process.wait()
        save_to_history()
        client.publish(TOPIC_TELEMETRY, json.dumps({"sim_status": "STOPPED"}))
    except Exception as e:
        print(f"Erro sim: {e}")
    finally:
        simulation_process = None

def on_message(client, userdata, msg):
    global simulation_process
    try:
        data = json.loads(msg.payload.decode())
        action = data.get("action")
        if action == "START_SIM":
            if simulation_process and simulation_process.poll() is None: return
            threading.Thread(target=run_ns3, args=(data.get("params", {}),)).start()
        elif action == "STOP_SIM":
            if simulation_process:
                os.killpg(os.getpgid(simulation_process.pid), signal.SIGTERM)
    except: pass

def on_connect(client, userdata, flags, rc):
    client.subscribe(TOPIC_CONTROL)

if __name__ == "__main__":
    init_db()
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_forever()
