import os
import json
import socket
import docker
from concurrent.futures import ThreadPoolExecutor
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Connect to local Docker daemon via socket
try:
    client = docker.from_env()
except Exception as e:
    client = None
    print(f"Error connecting to Docker socket: {e}")

# Helper utility to check a single port in a separate thread
def check_port(host, port, timeout=0.15):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        result = s.connect_ex((host, int(port)))
        s.close()
        return int(port), (result == 0)
    except:
        return int(port), False

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/containers', methods=['GET'])
def get_containers():
    if not client:
        return jsonify({"error": "Docker socket not available. Ensure '/var/run/docker.sock' is mounted."}), 500
    try:
        containers = client.containers.list(all=True)
        projects = {}
        standalone = []
        
        for c in containers:
            ports = []
            ports_raw = c.attrs.get('NetworkSettings', {}).get('Ports', {}) or {}
            for container_port, host_bindings in ports_raw.items():
                if host_bindings:
                    for binding in host_bindings:
                        host_ip = binding.get('HostIp', '0.0.0.0')
                        host_port = binding.get('HostPort', '')
                        if host_port:
                            ports.append(f"{host_ip}:{host_port}->{container_port}")
                else:
                    ports.append(f"{container_port} (internal)")
            
            state = c.attrs.get('State', {})
            labels = c.attrs.get('Config', {}).get('Labels', {}) or {}
            project_name = labels.get('com.docker.compose.project')
            
            container_info = {
                "id": c.id[:12],
                "full_id": c.id,
                "name": c.name,
                "image": c.attrs.get('Config', {}).get('Image', ''),
                "status": c.status,
                "state": {
                    "running": state.get("Running", False),
                    "status": state.get("Status", "unknown"),
                    "started_at": state.get("StartedAt", ""),
                    "finished_at": state.get("FinishedAt", ""),
                    "error": state.get("Error", "")
                },
                "ports": ports,
                "created": c.attrs.get("Created", ""),
                "compose": {
                    "project": project_name,
                    "service": labels.get('com.docker.compose.service', c.name)
                }
            }
            
            if project_name:
                if project_name not in projects:
                    projects[project_name] = []
                projects[project_name].append(container_info)
            else:
                standalone.append(container_info)
        
        # Sort lists alphabetically
        standalone.sort(key=lambda x: x['name'].lower())
        for p_name in projects:
            projects[p_name].sort(key=lambda x: x['name'].lower())
            
        return jsonify({
            "projects": projects,
            "standalone": standalone
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/containers/<id>/<action>', methods=['POST'])
def container_action(id, action):
    if not client:
        return jsonify({"error": "Docker socket not available"}), 500
    if action not in ['start', 'stop', 'restart']:
        return jsonify({"error": "Invalid action specified"}), 400
    try:
        container = client.containers.get(id)
        if action == 'start':
            container.start()
        elif action == 'stop':
            container.stop(timeout=5)
        elif action == 'restart':
            container.restart(timeout=5)
        return jsonify({"success": True, "status": container.status})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/containers/<id>/logs', methods=['GET'])
def get_logs(id):
    if not client:
        return jsonify({"error": "Docker socket not available"}), 500
    try:
        container = client.containers.get(id)
        logs = container.logs(tail=150, stdout=True, stderr=True).decode('utf-8', errors='ignore')
        return jsonify({"logs": logs})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/host-services', methods=['GET'])
def get_host_services():
    services_file = 'external_services.json'
    if not os.path.exists(services_file):
        return jsonify([])
        
    try:
        with open(services_file, 'r') as f:
            services = json.load(f)
    except Exception as e:
        return jsonify({"error": f"Failed to read host services config: {e}"}), 500
        
    # Find host target
    target_host = 'host.docker.internal'
    try:
        socket.gethostbyname(target_host)
    except socket.gaierror:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            parts = ip.split('.')
            parts[-1] = '1'
            target_host = ".".join(parts)
        except:
            target_host = '127.0.0.1'
            
    # Perform parallel scan to optimize CPU and response time
    ports_to_check = [s['port'] for s in services if s.get('port')]
    scan_results = {}
    
    with ThreadPoolExecutor(max_workers=len(ports_to_check) or 1) as executor:
        futures = {executor.submit(check_port, target_host, port, 0.15): port for port in ports_to_check}
        for future in futures:
            port, is_open = future.result()
            scan_results[port] = is_open

    results = []
    for svc in services:
        port = svc.get('port')
        is_active = scan_results.get(port, False) if port else False
        
        results.append({
            "name": svc.get('name', 'Unknown Host Service'),
            "port": port,
            "description": svc.get('description', ''),
            "status": 'ONLINE' if is_active else 'OFFLINE',
            "protocol": svc.get('protocol')
        })
        
    return jsonify(results)

@app.route('/api/ports-status', methods=['GET'])
def get_ports_status():
    if not client:
        return jsonify({"error": "Docker socket not available"}), 500
        
    target_host = 'host.docker.internal'
    try:
        socket.gethostbyname(target_host)
    except socket.gaierror:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            parts = ip.split('.')
            parts[-1] = '1'
            target_host = ".".join(parts)
        except:
            target_host = '127.0.0.1'

    occupied_ports = {}
    
    try:
        # 1. Gather all docker ports (running and stopped)
        containers = client.containers.list(all=True)
        for c in containers:
            ports_raw = c.attrs.get('NetworkSettings', {}).get('Ports', {}) or {}
            for container_port, host_bindings in ports_raw.items():
                if host_bindings:
                    for binding in host_bindings:
                        host_port = binding.get('HostPort')
                        if host_port:
                            occupied_ports[int(host_port)] = f"Docker: {c.name}"
                            
        # 2. Gather active host services from config file
        services_file = 'external_services.json'
        if os.path.exists(services_file):
            try:
                with open(services_file, 'r') as f:
                    services = json.load(f)
                
                # Filter only host services that are not already known to Docker
                host_svc_ports = [int(s['port']) for s in services if s.get('port') and int(s['port']) not in occupied_ports]
                
                # Probe them in parallel
                with ThreadPoolExecutor(max_workers=len(host_svc_ports) or 1) as executor:
                    futures = {executor.submit(check_port, target_host, port, 0.10): port for port in host_svc_ports}
                    for future in futures:
                        port, is_open = future.result()
                        if is_open:
                            # Match owner name
                            owner_name = next((s['name'] for s in services if int(s['port']) == port), 'Host Service')
                            occupied_ports[port] = f"Host: {owner_name}"
            except:
                pass
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    # 3. Check specific port if requested
    check_port_num = request.args.get('check')
    if check_port_num:
        try:
            port_to_check = int(check_port_num)
            if port_to_check in occupied_ports:
                return jsonify({
                    "port": port_to_check,
                    "status": "OCCUPIED",
                    "owner": occupied_ports[port_to_check]
                })
                
            # Perform a quick live port check
            _, is_open = check_port(target_host, port_to_check, 0.20)
            if is_open:
                return jsonify({
                    "port": port_to_check,
                    "status": "OCCUPIED",
                    "owner": "Proceso del Host (no registrado)"
                })
            return jsonify({
                "port": port_to_check,
                "status": "AVAILABLE",
                "owner": None
            })
        except Exception as e:
            return jsonify({"error": str(e)}), 400

    # 4. Generate suggested available ports in parallel
    candidates = [
        8081, 8082, 8083, 8084, 8085, 8086, 8087, 8088, 8089,
        9001, 9002, 9091, 3002, 3003, 5434, 5435, 8091, 8092, 8095
    ]
    # Filter candidates already taken by Docker/Host registry
    candidates_to_check = [p for p in candidates if p not in occupied_ports]
    suggested = []
    
    with ThreadPoolExecutor(max_workers=len(candidates_to_check) or 1) as executor:
        futures = {executor.submit(check_port, target_host, port, 0.05): port for port in candidates_to_check}
        for future in futures:
            port, is_open = future.result()
            if not is_open:
                suggested.append(port)
            if len(suggested) >= 5:
                break

    occupied_list = [{"port": p, "owner": owner} for p, owner in sorted(occupied_ports.items())]

    return jsonify({
        "occupied": occupied_list,
        "suggested": suggested
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
