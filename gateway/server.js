const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { Server } = require('socket.io');
const http = require('http');

const PROTO_PATH = __dirname + '/thread_monitor.proto';
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const proto = grpc.loadPackageDefinition(packageDefinition).threadmonitor;

const httpServer = http.createServer();
const io = new Server(httpServer, {
  cors: { origin: '*' } 
});

const GRPC_HOST = process.env.GRPC_SERVER || 'localhost:50051';

io.on('connection', (socket) => {
  console.log('Frontend conectado vía WebSocket');
  
  // Initiate gRPC client
  const grpcClient = new proto.ThreadMonitor(GRPC_HOST, grpc.credentials.createInsecure());
  const call = grpcClient.StreamThreads();

  call.on('data', (snapshot) => {
    socket.emit('snapshot', snapshot);
  });

  call.on('error', (err) => console.error('Error gRPC:', err));

  socket.on('command', (cmdData) => {
    call.write(cmdData);
  });

  call.write({ command: 'PING' });

  socket.on('disconnect', () => {
    console.log('Frontend disconnected');
    call.end();
  });
});

httpServer.listen(3001, () => {
  console.log('Gateway WebSocket corriendo en puerto 3001');
});