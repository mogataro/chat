'use strict';

const WebSocket = require('ws');
const http = require('http');
const crypto = require('crypto');
const dayjs = require('dayjs');
const xss = require('xss');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

/**
 * @typedef {Object} ClientInfo
 * @property {WebSocket} ws
 * @property {string} channel
 */

/** @type {Record<string, ClientInfo>} - uuidをキーに持つ */
const clients = {};

/**
 * @typedef {Object} SendMessageJson
 * @property {boolean} init
 * @property {string} uuid
 * @property {string} channel
 * @property {string} name
 * @property {string} message
 * @property {boolean} mine
 */

/**
 * @typedef {Object} ReceivedMessageJson
 * @property {boolean} init
 * @property {string} uuid
 * @property {string} channel
 * @property {string} name
 * @property {string} message
 */

// WebSocket接続, ws が接続したクライアント
wss.on('connection', (ws) => {
  // クライアント識別子
  const uuid = getRandomString();

  clients[uuid] = { ws };
  /** @type {SendMessageJson} */
  const initSendMessageJson = {
    init: true,
    uuid,
    channel: '',
    name: '',
    message: '',
    mine: false,
  };
  ws.send(JSON.stringify(initSendMessageJson));

  // メッセージ受信処理
  ws.on('message', (data) => {
    const json = JSON.parse(data);
    json.channel = json?.channel ? xss(json.channel) : '';
    json.uuid = json?.uuid ? xss(json.uuid) : '';

    // 初回コネクト時にクライアントから送られるメッセージの場合
    if (json?.init === true && json.channel && json.uuid) {
      clients[json.uuid].channel = json.channel;
      return;
    }

    if (!json?.message) return;
    json.time = dayjs();

    const targetChannel = json.channel;
    if (!!targetChannel) {
      sendMessageToChannel(targetChannel, json, ws);
    }
  });

  ws.on('close', () => {
    delete clients[uuid];
  });
});

/**
 * 引数のチャンネルにいるユーザーに受信したメッセージを送信
 * @param {string} targetChannel
 * @param {ReceivedMessageJson} receivedMessageJson - 受信メッセージ
 * @param {WebSocket} ws
 * @returns {undefined}
 */
function sendMessageToChannel(targetChannel, receivedMessageJson, ws) {
  /** @type {string[]} メッセージ送信者と同じチャンネルにいるクライアントのuuid配列 */
  const clientsInChannel = Object.entries(clients)
    .filter((clientArray) => {
      if (!targetChannel || !clientArray[1] || !clientArray[1]?.channel)
        return false;
      return clientArray[1].channel === targetChannel;
    })
    .map((clientArray) => clientArray[1].ws);

  clientsInChannel.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      /** @type {SendMessageJson} */
      const sendMessageJson = {
        ...receivedMessageJson,
        mine: ws === client,
      };
      client.send(JSON.stringify(sendMessageJson));
    }
  });
}

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
