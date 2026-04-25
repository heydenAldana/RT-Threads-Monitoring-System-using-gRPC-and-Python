import grpc
import datetime

# Generated modules. Don't touch them x2
import thread_monitor_pb2
import thread_monitor_pb2_grpc


# Just some utilities
def fmt_bytes(n: int) -> str:
    for unit in ('B', 'KB', 'MB', 'GB', 'TB'):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} PB"

def print_snapshot(snapshot: thread_monitor_pb2.ThreadSnapshot):
    #This prints a legible snapshot in the terminal
    ts = datetime.datetime.fromtimestamp(snapshot.timestamp_ms / 1000)
    s  = snapshot.stats
    mem_pct = (s.memory_used / s.memory_total * 100) if s.memory_total else 0
    print(f"\n{'─'*65}")
    print(
        f"  {ts.strftime('%H:%M:%S.%f')[:-3]}  |  "
        f"Threads: {snapshot.total_count:>5}  |  "
        f"CPU: {s.cpu_percent:>5.1f}%  |  "
        f"RAM: {fmt_bytes(s.memory_used)}/{fmt_bytes(s.memory_total)} ({mem_pct:.1f}%)"
    )
    print(f"{'─'*65}")
    # Top 5 threadsz CPU time (total accumulated)
    top5 = sorted(
        snapshot.threads,
        key=lambda t: t.user_time + t.system_time,
        reverse=True
    )[:5]
    print(f"  {'TID':>7}  {'PID':>7}  {'Process':<22}  {'State':<10}  {'CPU acum':>10}")
    print(f"  {'─'*58}")
    for t in top5:
        cpu_total = t.user_time + t.system_time
        print(
            f"  {t.tid:>7}  {t.pid:>7}  "
            f"{t.process_name:<22}  {t.status:<10}  {cpu_total:>9.2f}s"
        )


def run(host: str = 'localhost', port: int = 50051):
    # Handles the unerlying connection TCP + HTTP/2 
    with grpc.insecure_channel(f'{host}:{port}') as channel:
        stub = thread_monitor_pb2_grpc.ThreadMonitorStub(channel)
        # Petition (was defined in StreamRequest)
        request = thread_monitor_pb2.StreamRequest(
            interval_ms=1000, 
            pid=0, 
        )

        print(f"[ThreadMonitor] Connecting to {host}:{port}...")
        print("[ThreadMonitor] Ctrl+C to stop it\n")
        try:
            # StreamThreads return an iterator
            for snapshot in stub.StreamThreads(request):
                print_snapshot(snapshot)
        except grpc.RpcError as e:
            print(f"[Error gRPC] Code: {e.code()} — {e.details()}")
        except KeyboardInterrupt:
            print("\n[ThreadMonitor] Client has stopped!")


if __name__ == '__main__':
    run()