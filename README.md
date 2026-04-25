# RT-Threads-Monitoring-System-using-gRPC-and-Python
This repository serves as a useful resource to show how to use protoc to build a real time monitoring system for Threads, for educational purposes.

## Summary
The system follows a client–server model over gRPC. The contract (specifying which data is sent and how) is defined in a .proto file shared by both sides. The server reads the operating system in real-time and streams the data, which the client then consumes and displays.
