
const SIGNALING_HOST = "https://redesigned-fortnight-inq4.onrender.com/";

const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const peerIdInput = document.getElementById("peerId");
const statusText = document.getElementById("statusText");
const statusDot = document.getElementById("statusDot");
const roomPanel = document.getElementById("roomPanel");
const roomId = document.getElementById("roomId");
const connectedPanel = document.getElementById("connectedPanel");
const remoteAudio = document.getElementById("remoteAudio");
const errorBox = document.getElementById("error");
const copyBtn = document.getElementById("copyBtn");

let peer = null;
let localStream = null;
let activeCall = null;
let peerReady = false;

function setStatus(text, online = false) {
  statusText.textContent = text;
  statusDot.classList.toggle("ok", online);
}

function showError(text = "") {
  errorBox.textContent = text;
}

function setBusy(busy) {
  createBtn.disabled = busy;
  joinBtn.disabled = busy;
}

function createPeer() {
  if (!window.Peer) {
    throw new Error("Не удалось загрузить библиотеку PeerJS. Обнови страницу.");
  }

  if (!SIGNALING_HOST || SIGNALING_HOST === "ТВОЙ-СЕРВЕР.onrender.com") {
    throw new Error("Сначала укажи адрес своего сервера Render в app.js.");
  }

  return new Peer({
    host: SIGNALING_HOST,
    port: 443,
    path: "/peerjs",
    secure: true
  });
}

async function getMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      "Нет доступа к микрофону. Открой сайт по HTTPS в актуальном Chrome или Edge."
    );
  }

  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    video: false
  });
}

function stopMicrophone() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
}

function attachCall(call) {
  if (activeCall && activeCall !== call) {
    call.close();
    return;
  }

  activeCall = call;

  call.on("stream", async stream => {
    remoteAudio.srcObject = stream;

    try {
      await remoteAudio.play();
    } catch {
      showError("Нажми на страницу ещё раз, если браузер заблокировал звук.");
    }

    connectedPanel.classList.add("visible");
    roomPanel.classList.remove("visible");
    setStatus("Вы на связи — голос передаётся", true);
    showError("");
  });

  call.on("close", () => {
    if (activeCall !== call) return;

    activeCall = null;
    remoteAudio.srcObject = null;
    connectedPanel.classList.remove("visible");

    if (peer && roomId.textContent) {
      roomPanel.classList.add("visible");
    }

    setStatus("Собеседник отключился. Можно подключиться заново.", false);
  });

  call.on("error", err => {
    showError("Ошибка голосового соединения: " + (err?.message || "неизвестная ошибка"));
  });
}

function bindPeerEvents(p) {
  p.on("open", id => {
    peerReady = true;

    if (!roomId.textContent) {
      roomId.textContent = id;
      roomPanel.classList.add("visible");
      setStatus("Комната создана — отправь код другу", true);
    }

    setBusy(false);
  });

  p.on("connection", () => {
    // Голосовые вызовы обрабатываются в событии call.
  });

  p.on("call", call => {
    if (!localStream || activeCall) {
      call.close();
      return;
    }

    call.answer(localStream);
    attachCall(call);
  });

  p.on("disconnected", () => {
    setStatus("Потеряна связь с сервером. Проверь интернет.", false);
  });

  p.on("close", () => {
    peerReady = false;
    setStatus("Соединение с сервером закрыто", false);
  });

  p.on("error", err => {
    let message = err?.message || String(err);

    if (err?.type === "peer-unavailable") {
      message = "Комната не найдена. Проверь код и попроси друга открыть комнату заново.";
    } else if (err?.type === "network" || err?.type === "server-error") {
      message = "Не удалось связаться с сервером сигнализации. Проверь адрес Render и доступность сервера.";
    } else if (err?.type === "unavailable-id") {
      message = "Этот идентификатор уже занят. Попробуй создать комнату заново.";
    }

    showError(message);
    setStatus("Не удалось установить соединение", false);
    setBusy(false);
  });
}

async function createRoom() {
  showError("");
  setBusy(true);

  try {
    localStream = await getMicrophone();
    peer = createPeer();
    bindPeerEvents(peer);
    setStatus("Подключаемся к серверу…", false);
  } catch (err) {
    stopMicrophone();
    showError(err?.message || String(err));
    setStatus("Не удалось создать комнату", false);
    setBusy(false);
  }
}

async function joinRoom() {
  const targetId = peerIdInput.value.trim();

  if (!targetId) {
    showError("Сначала вставь код комнаты друга.");
    return;
  }

  showError("");
  setBusy(true);

  try {
    localStream = await getMicrophone();
    peer = createPeer();
    bindPeerEvents(peer);

    peer.on("open", () => {
      setStatus("Подключаемся к комнате…", false);

      const call = peer.call(targetId, localStream);

      if (!call) {
        showError("Не удалось начать звонок. Проверь код комнаты.");
        setBusy(false);
        return;
      }

      attachCall(call);
    });
  } catch (err) {
    stopMicrophone();
    showError(err?.message || String(err));
    setStatus("Не удалось подключиться", false);
    setBusy(false);
  }
}

async function hangup() {
  if (activeCall) {
    const call = activeCall;
    activeCall = null;
    try {
      call.close();
    } catch {}
  }

  if (peer) {
    try {
      peer.destroy();
    } catch {}
  }

  stopMicrophone();

  peer = null;
  peerReady = false;
  remoteAudio.srcObject = null;

  roomPanel.classList.remove("visible");
  connectedPanel.classList.remove("visible");
  roomId.textContent = "";

  setBusy(false);
  setStatus("Звонок завершён", false);
  showError("");
}

createBtn.addEventListener("click", createRoom);
joinBtn.addEventListener("click", joinRoom);
document.getElementById("hangupBtn").addEventListener("click", hangup);

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(roomId.textContent);
    copyBtn.textContent = "Код скопирован ✓";

    setTimeout(() => {
      copyBtn.textContent = "Скопировать код";
    }, 1600);
  } catch {
    showError("Не удалось скопировать автоматически. Выдели код и скопируй вручную.");
  }
});

window.addEventListener("beforeunload", () => {
  stopMicrophone();

  if (peer) {
    peer.destroy();
  }
});
