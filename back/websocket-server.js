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
 * @property {string} name
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
 * @property {'mine'|'other'|'info'|'admin_number-in-channel'} type
 * @property {dayjs.Dayjs|null} time
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
  // クライアント識別子(ID)
  const uuid = getRandomId();

  // 既に同じuuidを持つユーザがいた場合
  if (Object.keys(clients).some((clientId) => clientId === uuid)) {
    sendFailedGetIdMessage(ws);
    return;
  }

  clients[uuid] = {}; // clientsにclientプロパティ追加
  clients[uuid].ws = ws; // clientにwsプロパティ追加

  sendInitMessage(uuid);

  // メッセージ受信処理
  ws.on('message', (data) => {
    /** @type {ReceivedMessageJson} */
    const json = JSON.parse(data);
    json.name =
      typeof json?.name === 'string' ? json.name.substring(0, 10) : '名無し';
    json.channel = json?.channel ? xss(json.channel) : '';
    json.uuid = json?.uuid ? xss(json.uuid) : '';

    // 初回コネクト時にクライアントから送られるメッセージの場合
    if (json?.init === true && json.channel && json.uuid) {
      clients[json.uuid].name = json.name; // clientにnameプロパティ追加
      clients[json.uuid].channel = json.channel; // clientにchannelプロパティ追加
      sendLoginOrLogoutMessage(uuid, 'login');
      sendNumberInChannelAdminMessage(json.channel, 'login');
      return;
    }

    // 同じチャンネルにいるユーザにメッセージ送信
    if (!!json.channel && typeof json?.message === 'string') {
      sendMessageToChannel(json, ws);
    }
  });

  ws.on('close', () => {
    sendLoginOrLogoutMessage(uuid, 'logout');
    sendNumberInChannelAdminMessage(clients[uuid].channel, 'logout');
    delete clients[uuid];
  });
});

/**
 * 接続ユーザに対して、ID取得失敗メッセージを送信
 * @param {WebSocket} ws
 * @returns {false}
 */
function sendFailedGetIdMessage(ws) {
  /** @type {SendMessageJson} */
  const messageJson = {
    init: false,
    uuid: '',
    channel: '',
    name: 'システム通知',
    message: 'IDの取得に失敗しました。ページを更新して下さい。',
    type: 'info',
    time: dayjs(),
  };
  ws.send(JSON.stringify(messageJson));
}

/**
 * 接続ユーザに対してuuidを送る
 * @param {string} uuid
 * @returns {false}
 */
function sendInitMessage(uuid) {
  /** @type {SendMessageJson} */
  const initSendMessageJson = {
    init: true,
    uuid,
    channel: '',
    name: '',
    message: '',
    type: 'info',
    time: null,
  };
  clients[uuid].ws.send(JSON.stringify(initSendMessageJson));
}

/**
 * 入室/退室メッセージを送信
 * @param {string} uuid
 * @param {'login'|'logout'} mode
 * @returns {false}
 */
function sendLoginOrLogoutMessage(uuid, mode) {
  const clientsInChannel = getClientsInChannel(clients[uuid].channel);

  const doing = mode === 'login' ? '入室' : '退室';

  clientsInChannel.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      /** @type {SendMessageJson} */
      const sendMessageJson = {
        init: false,
        uuid: '',
        channel: '',
        name: 'システム通知',
        message: `${clients[uuid].name}さん(${uuid})が${doing}しました！`,
        type: 'info',
        time: dayjs(),
      };
      client.send(JSON.stringify(sendMessageJson));
    }
  });
}

/**
 * 引数のチャンネルにいるユーザーに受信したメッセージを送信
 * @param {ReceivedMessageJson} receivedMessageJson - 受信メッセージ
 * @param {WebSocket} ws
 * @returns {undefined}
 */
function sendMessageToChannel(receivedMessageJson, ws) {
  /** @type {string[]} メッセージ送信者と同じチャンネルにいるクライアントのuuid配列 */
  const clientsInChannel = getClientsInChannel(receivedMessageJson.channel);

  clientsInChannel.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      /** @type {SendMessageJson} */
      const sendMessageJson = {
        ...receivedMessageJson,
        init: false,
        name: receivedMessageJson.name.substring(0, 10),
        type: ws === client ? 'mine' : 'other',
        time: dayjs(),
      };
      client.send(JSON.stringify(sendMessageJson));
    }
  });
}

/**
 * チャンネルにいる人数を管理メッセージで送信
 * @param {string} channel
 * @oaram {'login'|'logout'} mode
 * @returns {undefined}
 */
function sendNumberInChannelAdminMessage(channel, mode) {
  /** @type {string[]} メッセージ送信者と同じチャンネルにいるクライアントのuuid配列 */
  const clientsInChannel = getClientsInChannel(channel);
  const numberInChannel =
    mode === 'login'
      ? String(clientsInChannel.length)
      : String(clientsInChannel.length - 1);

  clientsInChannel.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      /** @type {SendMessageJson} */
      const sendMessageJson = {
        init: false,
        uuid: '',
        channel: '',
        name: '',
        message: numberInChannel,
        type: 'admin_number-in-channel',
        time: '',
      };
      client.send(JSON.stringify(sendMessageJson));
    }
  });
}

/**
 * チャンネルにいるクライアントのuuid配列
 * @param {string} channel
 * @returns {string[]}
 */
function getClientsInChannel(channel) {
  if (!channel) {
    return [];
  }
  return Object.entries(clients)
    .filter((clientArray) => {
      if (!clientArray[1] || !clientArray[1]?.channel) return false;
      return clientArray[1].channel === channel;
    })
    .map((clientArray) => clientArray[1].ws);
}

/**
 * 10文字のランダム文字列IDを返却
 * @returns {string}
 */
function getRandomId() {
  const strings =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const randomString = Array.from(crypto.getRandomValues(new Uint32Array(10)))
    .map((v) => strings[v % strings.length])
    .join('');
  return randomString;
}

server.listen(8000, () => {
  console.log('WebSocket Server is running on port 8000');
});
