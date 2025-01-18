const ws = new WebSocket('ws://localhost:8000');

let uuid = '';
let channel = '';
let userName = '';

document.addEventListener('DOMContentLoaded', () => {
  const queryParams = new URLSearchParams(window.location.search);
  channel = queryParams.get('channel');
  userName = queryParams.get('name') || '名無し';

  // ヘッダーにチャンネル番号を表示
  const roomChannelElement = document.querySelector('.room__channel');
  if (!!roomChannelElement) roomChannelElement.textContent += channel;
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
  const json = JSON.parse(event.data);
  if (json?.init) {
    uuid = json.uuid;
    /** @type {SendMessageJson} */
    const messageJson = {
      init: true,
      uuid,
      channel,
      name: userName,
      message: '',
    };
    ws.send(JSON.stringify(messageJson));

    const roomUuidElement = document.querySelector('.room__uuid');
    if (!!roomUuidElement) roomUuidElement.textContent += uuid;
  } else if (json.hasOwnProperty('mine')) {
    const chatDiv = document.getElementById('chat');
    /** @type {ReceivedMessageJson} */
    const receivedMessageJson = json;
    chatDiv.appendChild(createMessage(receivedMessageJson));
    chatDiv.scrollTo(0, chatDiv.scrollHeight);
  }
};

/**
 * メッセージ送信
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
 * @property {boolean} mine
 */

/**
 * メッセージを表示するHTML要素を返却
 * @param {ReceivedMessageJson} json
 * @returns {HTMLDivElement}
 */
function createMessage(json) {
  const side = json.mine ? 'message--mine' : 'message--other';
  const sideElement = createDiv(`message ${side}`);
  const sideTextElement = createDiv('message__inner');
  const textElement = createDiv('message__text');
  const nameElement = createDiv('message__name');
  const timeElement = createDiv('message__time');
  const infoElement = createDiv('message__info');

  textElement.textContent = json.message;
  sideElement.appendChild(sideTextElement);
  sideTextElement.appendChild(textElement);
  nameElement.textContent = json.name;
  timeElement.textContent = dayjs(json.time).format('M/D HH:mm');
  infoElement.appendChild(nameElement);
  infoElement.appendChild(timeElement);
  sideTextElement.appendChild(infoElement);
  return sideElement;
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
