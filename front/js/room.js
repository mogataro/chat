const ws = new WebSocket('ws://localhost:8000');

let uuid = '';
let channel = '';
let userName = '';

document.addEventListener('DOMContentLoaded', () => {
  setUserNameAndChannel();

  // ヘッダーにチャンネル番号を表示
  const roomChannelElement = document.querySelector('.room__channel');
  if (!!roomChannelElement) roomChannelElement.textContent += channel;
  // ヘッダーに名前を表示
  const roomNameElement = document.querySelector('.room__name');
  if (!!roomNameElement) roomNameElement.textContent += userName;
});

/**
 * @typedef {Object} SendMessageJson
 * @property {boolean} init
 * @property {string} uuid
 * @property {string} channel
 * @property {string} name
 * @property {string} message
 */

/**
 * メッセージ受信処理
 */
ws.onmessage = function (event) {
  /** @type {ReceivedMessageJson} */
  const json = JSON.parse(event.data);
  if (json?.init === true) {
    uuid = json.uuid;

    sendInitMessage();

    const roomUuidElement = document.querySelector('.room__uuid');
    if (!!roomUuidElement) roomUuidElement.textContent += uuid;
  } else {
    const chatDiv = document.getElementById('chat');
    const receivedMessageJson = json;
    chatDiv.appendChild(createMessage(receivedMessageJson));
    chatDiv.scrollTo(0, chatDiv.scrollHeight);
  }
};

/**
 * channelとname情報メッセージを送る
 * 初回コネクト時に実行する
 */
function sendInitMessage() {
  /** @type {SendMessageJson} */
  const messageJson = {
    init: true,
    uuid,
    channel,
    name: userName,
    message: '',
  };
  ws.send(JSON.stringify(messageJson));
}

/**
 * 入力メッセージ送信
 */
function sendMessage() {
  /** @type {SendMessageJson} */
  const messageJson = {
    init: false,
    uuid,
    channel,
    name: userName,
    message: document.getElementById('messageInput').value,
  };
  ws.send(JSON.stringify(messageJson));
  document.getElementById('messageInput').value = '';
}

/**
 * @typedef {Object} ReceivedMessageJson
 * @property {boolean} init
 * @property {string} uuid
 * @property {string} channel
 * @property {string} name
 * @property {string} message
 * @property {'mine'|'other'|'info'} type
 * @property {dayjs.Dayjs|null} time
 */

/**
 * メッセージを表示するHTML要素を返却
 * @param {ReceivedMessageJson} json
 * @returns {HTMLDivElement}
 */
function createMessage(json) {
  const messageModifier = getMessageModifier(json.type);
  const messageElement = createDiv(`message ${messageModifier}`);
  const messageInnerElement = createDiv('message__inner');
  const textElement = createDiv('message__text');
  const nameElement = createDiv('message__name');
  const timeElement = createDiv('message__time');
  const belowTextElement = createDiv('message__below-text');

  messageElement.appendChild(messageInnerElement);
  messageInnerElement.appendChild(textElement);
  belowTextElement.appendChild(nameElement);
  belowTextElement.appendChild(timeElement);
  messageInnerElement.appendChild(belowTextElement);

  textElement.textContent = json.message;
  nameElement.textContent = json.uuid
    ? `${json.name}(${json.uuid})`
    : json.name;
  timeElement.textContent = dayjs(json.time).format('M/D HH:mm');

  return messageElement;
}

/**
 * messageクラスのモディファイアを返却する
 * @param {'mine'|'other'|'info'} type
 * @returns
 */
function getMessageModifier(type) {
  // NOTE: モディファイアクラス名がどこで指定されているのか検索できるように、変数(type)を連結せずに記述している
  switch (type) {
    case 'mine':
      return 'message--mine';
    case 'other':
      return 'message--other';
    case 'info':
      return 'message--info';
    default:
      return '';
  }
}

/**
 * 引数のクラス名を持つdiv要素を生成
 * @param {string} classNames
 * @returns
 */
function createDiv(className) {
  const element = document.createElement('div');
  element.className = className;
  return element;
}

/**
 * userNameとチャンネルをsetする。
 * 不正なチャンネルはログインページに戻す
 * @returns {undefined}
 */
function setUserNameAndChannel() {
  const searchParams = new URLSearchParams(window.location.search);
  let tempUserName = searchParams.get('name') || '名無し';
  let tempChannel = searchParams.get('channel');
  const tempNumberChannel = Number(tempChannel);

  if (
    tempNumberChannel < 0 ||
    tempNumberChannel > 99999 ||
    Number.isNaN(tempNumberChannel)
  ) {
    window.location.href = '/index.html';
    return;
  }

  if (tempUserName.length > 10) {
    tempUserName = tempUserName.substring(0, 10);
    searchParams.set('name', tempUserName);
    window.location.search = searchParams.toString();
  }

  userName = tempUserName;
  channel = tempChannel;
}
