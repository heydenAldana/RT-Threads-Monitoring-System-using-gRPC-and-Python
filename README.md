# RT-Threads-Monitoring-System-using-gRPC-and-Python
This repository serves as a useful resource to show how to use protoc to build a real time monitoring system for Threads, for educational purposes.

## Summary
The system follows a client–server model over gRPC. The contract (specifying which data is sent and how) is defined in a .proto file shared by both sides. The server reads the operating system in real-time and streams the data, which the client then consumes and displays.

## File Structure

Here is a short and brief description of the project files in case you are wondering

```
thread_monitor/
│
├── thread_monitor.proto        # Shared contract: messages + service definition
│                               # Edit this first whenever the API changes.
│
├── server.py                   # gRPC server — reads threads, handles commands
├── client.py                   # gRPC client — displays snapshots, sends commands
├── requirements.txt            # Python dependencies (grpcio, psutil)
│
├── Dockerfile.server           # Server image — compiles proto at build time
├── Dockerfile.client           # Client image — compiles same proto at build time
├── docker-compose.yml          # Orchestrates both services on a shared network
└── .dockerignore               # Keeps images clean (excludes caches, docs, etc.)
```

## How the proto contract works
 
`thread_monitor.proto` defines two things:
 
- **Messages** — typed data structures (`ThreadInfo`, `ThreadSnapshot`, `ClientCommand`, …)
- **Service** — the RPC methods the server exposes
```protobuf
service ThreadMonitor {
  rpc GetSnapshot  (SnapshotRequest)       returns (ThreadSnapshot);         // unary
  rpc StreamThreads(stream ClientCommand)  returns (stream ThreadSnapshot);  // bidi
}
```

`StreamThreads` is a **bidirectional streaming RPC**: the server yields snapshots
while the client sends commands — both directions over the same HTTP/2 connection.

## Running with Docker (recommended)
 
### Prerequisites
 
- Docker ≥ 24
- Docker Compose plugin (`docker compose`, not `docker-compose`)
### Start
 
```bash
# Build images and start both services
docker compose up --build
```
 
### Attach the interactive client
 
The client requires a TTY to receive keyboard input.
Open a second terminal and run:
 
```bash
docker compose attach client # docker
podman compose up --build # podman
```
 
You should see the live thread table and the command prompt.
 
### Stop
 
```bash
# Ctrl+C in the compose terminal, then:
docker compose down #docker
podman compsoe down -v # podman
```

 
## Running without Docker
 
### Prerequisites
 
```bash
pip install grpcio grpcio-tools psutil
```
 
### Compile the contract
 
Run this once, and again every time `thread_monitor.proto` changes:
 
```bash
python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. thread_monitor.proto
```
 
### Start server (terminal 1)
 
```bash
python server.py
```
 
### Start client (terminal 2)
 
```bash
python client.py
```

## Testing the unary RPC with grpcurl
 
`GetSnapshot` (single request → single response) can be tested without the client:
 
```bash
grpcurl -plaintext -d '{"pid": 0}' localhost:50051 threadmonitor.ThreadMonitor/GetSnapshot
```

## Monitoring the host machine (optional)
 
By default, the server only sees threads **inside its own container**.
To monitor all processes on the host, edit `docker-compose.yml`:
 
```yaml
server:
  # ...
  pid: "host"
  privileged: true
```
 
> WARNING: This breaks container isolation. Use only in trusted, controlled environments.