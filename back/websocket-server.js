'use strict';

const WebSocket = require('ws');
const http = require('http');
const crypto = require('crypto');
const dayjs = require('dayjs');
const xss = require('xss');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

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
  const uuid = getRandomString();

  clients[uuid] = { ws };
  ws.send(JSON.stringify({ uuid, init: true }));

  // メッセージ受信処理
  ws.on('message', (data) => {
    const json = JSON.parse(data);
    json.channel = json?.channel ? xss(json.channel) : '';
    json.uuid = json?.uuid ? xss(json.uuid) : '';

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

/**
 * ランダム文字列を返却
 * @returns {string}
 */
function getRandomString() {
  const strings =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from(crypto.getRandomValues(new Uint32Array(10)))
    .map((v) => strings[v % strings.length])
    .join('');
}

server.listen(8000, () => {
  console.log('WebSocket Server is running on port 8000');
});
