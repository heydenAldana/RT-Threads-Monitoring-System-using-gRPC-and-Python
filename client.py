import grpc
import threading
import queue
import datetime
import sys
import os

# Generated modules. Don't touch them x2
import thread_monitor_pb2 as pb
import thread_monitor_pb2_grpc as pb_grpc

# Command queue
_cmd_queue: queue.Queue = queue.Queue()
_shutdown_event = threading.Event()

def command_generator():
    # Initial handshake
    yield pb.ClientCommand(command=pb.CommandType.PING)
 
    while not _shutdown_event.is_set():
        try:
            # Wait command with timeout to shutdown
            cmd = _cmd_queue.get(timeout=0.5)
            if cmd is None:
                return
            yield cmd
        except queue.Empty:
            continue 
 

HELP_TEXT = """
┌─────────────────────────────────────────────────────┐
│  AVAILABLE COMMANDS (press Enter to confirm)        │
├─────────────────────────────────────────────────────┤
│  p           PAUSE  (pause the stream)              │
│  r           RESUME (continues the stream)          │
│  f <pid>     FILTER (filer by PID, 0=all)           │
│  k <pid>     KILL   (SIGTERM to the process)        │
│  h           Show this message                      │
│  q           quit                                   │ 
└─────────────────────────────────────────────────────┘
"""

def keyboard_reader():
    while not _shutdown_event.is_set():
        try:
            line = input().strip().lower()
        except EOFError:
            break
        parts = line.split()
        if not parts:
            continue
        cmd_key = parts[0]
        if cmd_key == 'p':
            _cmd_queue.put(pb.ClientCommand(command=pb.CommandType.PAUSE))
            print("  [DEBUG]  Command PAUSE")
        elif cmd_key == 'r':
            _cmd_queue.put(pb.ClientCommand(command=pb.CommandType.RESUME))
            print("  [DEBUG]  Command RESUME")
        elif cmd_key == 'f':
            try:
                pid = int(parts[1]) if len(parts) > 1 else 0
            except ValueError:
                print("  Use case: f <pid>  (example: f 1234, f 0 = all)")
                continue
            _cmd_queue.put(pb.ClientCommand(
                command=pb.CommandType.FILTER,
                target_pid=pid,
            ))
            label = f"pid={pid}" if pid else "All processes"
            print(f"  [DEBUG]  Command FILTER → {label}") 
        elif cmd_key == 'k':
            try:
                pid = int(parts[1]) if len(parts) > 1 else 0
            except ValueError:
                print("  [DEBUG]  Use case: k <pid>  (example: k 1234)")
                continue
            if pid == 0:
                print("  [WARNING]  KILL requires an specific pid (≠ 0)")
                continue
            # Confirmación de seguridad
            confirm = input(f"  ¿Enviar SIGTERM a pid={pid}? [s/N]: ").strip().lower()
            if confirm == 's':
                _cmd_queue.put(pb.ClientCommand(
                    command=pb.CommandType.KILL,
                    target_pid=pid,
                ))
                print(f"  [DEBUG]  Command KILL pid={pid}")
            else:
                print("  Canceled") 
        elif cmd_key == 'h':
            print(HELP_TEXT)
        elif cmd_key == 'q':
            print("  Closing connection...")
            _shutdown_event.set()
            _cmd_queue.put(None) 
            break
        else:
            print(f"  [WARNING] Unknown command: '{cmd_key}'. Press h for help")
 
 
# SNAPSHOT FORMATING
def fmt_bytes(n: int) -> str:
    for unit in ('B', 'KB', 'MB', 'GB', 'TB'):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} PB"
 
 
def print_snapshot(snapshot: pb.ThreadSnapshot):
    # Don¿t print keepalive snapshots
    if snapshot.is_paused:
        sys.stdout.write(f"\r  [DEBUG] PAUSED. Last cmd: [{snapshot.cmd_echo}]   ")
        sys.stdout.flush()
        return
    ts  = datetime.datetime.fromtimestamp(snapshot.timestamp_ms / 1000)
    s   = snapshot.stats
    mem_pct = (s.memory_used / s.memory_total * 100) if s.memory_total else 0
    cmd_info = f" │ cmd: [{snapshot.cmd_echo}]" if snapshot.cmd_echo else ""
    print(f"\n{'═'*68}")
    print(
        f"  {ts.strftime('%H:%M:%S.%f')[:-3]}"
        f"  │  Threads: {snapshot.total_count:>5}"
        f"  │  CPU: {s.cpu_percent:>5.1f}%"
        f"  │  RAM: {fmt_bytes(s.memory_used)} ({mem_pct:.0f}%)"
        f"{cmd_info}"
    )
    print(f"{'─'*68}")
    # Top 8 threads x CPU
    top = sorted(
        snapshot.threads,
        key=lambda t: t.user_time + t.system_time,
        reverse=True,
    )[:8]
    if not top:
        print("  [WARNING] No Threads visible with the actual config)")
        return
    print(f"  {'TID':>7}  {'PID':>7}  {'Process':<22}  {'State':<10}  {'Total CPU':>10}")
    print(f"  {'─'*60}")
    for t in top:
        cpu = t.user_time + t.system_time
        print(
            f"  {t.tid:>7}  {t.pid:>7}  "
            f"{t.process_name:<22}  {t.status:<10}  {cpu:>9.2f}s"
        )
 
 
# MAIN CLIENT
def run(
    host: str = os.getenv('SERVER_HOST', 'localhost'),
    port: int = int(os.getenv('SERVER_PORT', '50051'))
):
    with grpc.insecure_channel(f'{host}:{port}') as channel:
        stub = pb_grpc.ThreadMonitorStub(channel)
        print(f"[ThreadMonitor v2] Connected to {host}:{port} (bidi streaming)...")
        kb_thread = threading.Thread(
            target=keyboard_reader,
            daemon=True,
            name="keyboard-reader",
        )
        kb_thread.start()
        try:
            # stub.StreamThreads receives the command generator
            # and returns a snapshot iterator.
            # Now using a bidirectional HTTP/2
            for snapshot in stub.StreamThreads(command_generator()):
                if _shutdown_event.is_set():
                    break
                os.system('cls' if os.name == 'nt' else 'clear')
                print(HELP_TEXT)
                print_snapshot(snapshot)
        except grpc.RpcError as e:
            if e.code() != grpc.StatusCode.CANCELLED:
                print(f"\n[Error gRPC] {e.code()}: {e.details()}")
        except KeyboardInterrupt:
            _shutdown_event.set()
            _cmd_queue.put(None)
        finally:
            print("\n[ThreadMonitor v2] Disconnected")
 
 
if __name__ == '__main__':
    run()