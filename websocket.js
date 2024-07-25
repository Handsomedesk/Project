// 실시간 알림 (웹소켓 사용)
// websocket.js

const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    console.log('received: %s', message);
  });

  ws.send(JSON.stringify({ message: 'Connected to WebSocket server' }));
});

const sendWebSocketNotification = (userId, data) => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client.userId === userId) {
      client.send(JSON.stringify(data));
    }
  });
};

module.exports = {
  wss,
  sendWebSocketNotification
};
