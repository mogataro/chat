'use strict';

const WebSocket = require('ws');
const http = require('http');
const crypto = require('crypto');
const dayjs = require('dayjs');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

server.on('request', doRequest);

function doRequest(req, res) {
  switch (req.method) {
    case 'GET':
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.write('websocket-server');
      res.end();
      break;
    case 'POST':
      break;
  }
}

/**
 * @typedef {Object} clientInfo
 * @property {WebSocket} ws
 * @property {string} channel
 */

/** @type {Record<string, clientInfo>} - uuidをキーに持つ */
const clients = {}

// WebSocket接続, ws が接続したクライアント
wss.on('connection', (ws) => {
  // クライアント識別子
  const uuid = crypto.randomUUID();
  clients[uuid] = { ws };
  ws.send(JSON.stringify({ uuid, init: true }));

  // メッセージ受信処理
  ws.on('message', (data) => {
    const json = JSON.parse(data);

    // 初回コネクト時にクライアントから送られるメッセージ
    if (json?.init) {
      clients[json.uuid].channel = json.channel
      return;
    }

    if (!json.message) return;
    json.time = dayjs();

    /** メッセージ送信者のチャンネル */
    const targetChannel = json?.channel ?? '';
    /** @type {string[]} メッセージ送信者と同じチャンネルにいるクライアントのuuid配列 */
    const clientsInChannel = Object.entries(clients)
      .filter((clientArray) => {
        if (!targetChannel || !clientArray[1] || !clientArray[1]?.channel) return false;
        return clientArray[1].channel === targetChannel;
      })
      .map((clientArray) => clientArray[1].ws)

    clientsInChannel.forEach((client) => {
      json.mine = ws === client;
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(json));
      }
    });
  });

  ws.on('close', () => {
    delete clients[uuid];
  });
});

server.listen(8000, () => {
  console.log('WebSocket Server is running on port 8000');
});