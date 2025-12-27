// --- SECURITY ---
console.log = function () {};
console.warn = function () {};
console.error = function () {};
document.addEventListener("contextmenu", (e) => e.preventDefault());
document.onkeydown = function (e) {
  if (
    e.keyCode == 123 ||
    (e.ctrlKey &&
      e.shiftKey &&
      (e.keyCode == "I".charCodeAt(0) || e.keyCode == "J".charCodeAt(0))) ||
    (e.ctrlKey && e.keyCode == "U".charCodeAt(0))
  )
    return false;
};
// ----------------

const socket = io();

// DOM Elements
const chatBox = document.getElementById("chat-box");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const headerStopBtn = document.getElementById("header-stop-btn");
const userCountSpan = document.getElementById("user-count");
const typingIndicator = document.getElementById("typing-indicator");
const interestsInput = document.getElementById("interests-input");
const matchInfo = document.getElementById("match-info");
const matchDetails = document.getElementById("match-details");
const profileSection = document.getElementById("profile-section");
const interestsSection = document.querySelector(".interests-section");
const statusOverlay = document.getElementById("status-overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlaySubtitle = document.getElementById("overlay-subtitle");
const radarAnim = document.getElementById("radar-anim");
const nicknameInput = document.getElementById("nickname-input");
const ageInput = document.getElementById("age-input");
const genderInput = document.getElementById("gender-input");
const themeToggle = document.getElementById("theme-toggle");
const muteBtn = document.getElementById("mute-btn");
const icebreakerBtn = document.getElementById("icebreaker-btn");
const emojiBtn = document.getElementById("emoji-btn");
const cameraBtn = document.getElementById("camera-btn");
const emojiPopover = document.getElementById("emoji-popover");
const imageInput = document.getElementById("image-input");
const toastContainer = document.getElementById("toast-container");
const customModal = document.getElementById("custom-modal");
const modalTitle = document.getElementById("modal-title");
const modalMessage = document.getElementById("modal-message");
const modalBtn = document.getElementById("modal-btn");
const tosModal = document.getElementById("tos-modal");
const tosAgreeBtn = document.getElementById("tos-agree-btn");

const msgSound = new Audio("msg.mp3");
const matchSound = new Audio("notify.mp3");

let isConnected = false;
let typingTimeout;
let isMuted = false;

const icebreakers = [
  "What's the last movie you watched?",
  "Do you believe in aliens?",
  "Cats or Dogs?",
  "What is your dream travel destination?",
  "If you could have one superpower, what would it be?",
  "Pizza or Burgers?",
  "What's the weirdest thing you've ever eaten?",
  "Coffee or Tea?",
];

// --- Helper: Toasts & Modals ---
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icon = type === "error" ? "⚠️" : type === "success" ? "✅" : "ℹ️";
  toast.innerHTML = `<span>${icon}</span> ${message}`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = "fadeOut 0.3s forwards";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
function showModal(title, message, btnText = "OK", onConfirm = null) {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalBtn.textContent = btnText;
  customModal.style.display = "flex";
  modalBtn.onclick = () => {
    if (onConfirm) onConfirm();
    customModal.style.display = "none";
  };
}

// --- TAB LOGIC ---
const tabChannel = new BroadcastChannel("tertalk_tabs");
tabChannel.postMessage("new_tab_opened");
tabChannel.onmessage = (event) => {
  if (event.data === "new_tab_opened") {
    socket.disconnect();
    showModal(
      "Connection Paused",
      "TerTalk is open in another tab.",
      "Reload Here",
      () => {
        window.location.reload();
      }
    );
    startBtn.style.display = "none";
    stopBtn.style.display = "none";
    headerStopBtn.style.display = "none";
    toggleInputs(true);
    updateOverlay("Disconnected", "Open in another tab.", false);
    tabChannel.close();
  }
};

window.addEventListener("load", () => {
  if (!localStorage.getItem("tertalk_tos_accepted")) {
    tosModal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(console.error);
  }

  if (localStorage.getItem("chat_nickname"))
    nicknameInput.value = localStorage.getItem("chat_nickname");
  if (localStorage.getItem("chat_age"))
    ageInput.value = localStorage.getItem("chat_age");
  if (localStorage.getItem("chat_gender"))
    genderInput.value = localStorage.getItem("chat_gender");
  if (localStorage.getItem("chat_interests"))
    interestsInput.value = localStorage.getItem("chat_interests");
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    themeToggle.textContent = "☀️";
    document.querySelector("emoji-picker").classList.add("dark");
  }
  if (localStorage.getItem("muted") === "true") {
    isMuted = true;
    muteBtn.textContent = "🔇";
  }
});

tosAgreeBtn.addEventListener("click", () => {
  localStorage.setItem("tertalk_tos_accepted", "true");
  tosModal.style.display = "none";
  document.body.style.overflow = "auto";
  matchSound.play().catch((e) => {});
});

// Mobile Header Button (Mirrors the main button)
headerStopBtn.addEventListener("click", () => stopBtn.click());

themeToggle.addEventListener("click", () => {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const picker = document.querySelector("emoji-picker");
  if (currentTheme === "dark") {
    document.documentElement.setAttribute("data-theme", "light");
    localStorage.setItem("theme", "light");
    themeToggle.textContent = "🌙";
    picker.classList.remove("dark");
  } else {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("theme", "dark");
    themeToggle.textContent = "☀️";
    picker.classList.add("dark");
  }
});
muteBtn.addEventListener("click", () => {
  isMuted = !isMuted;
  muteBtn.textContent = isMuted ? "🔇" : "🔊";
  localStorage.setItem("muted", isMuted);
});
icebreakerBtn.addEventListener("click", () => {
  if (!isConnected) return;
  messageInput.value =
    icebreakers[Math.floor(Math.random() * icebreakers.length)];
  messageInput.focus();
});
emojiBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  emojiPopover.style.display =
    emojiPopover.style.display === "block" ? "none" : "block";
});
document
  .querySelector("emoji-picker")
  .addEventListener("emoji-click", (event) => {
    messageInput.value += event.detail.unicode;
    messageInput.focus();
  });
document.addEventListener("click", (e) => {
  if (!emojiBtn.contains(e.target) && !emojiPopover.contains(e.target))
    emojiPopover.style.display = "none";
});

cameraBtn.addEventListener("click", () => {
  if (isConnected) imageInput.click();
});
imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    showToast("Image too large! Max 2MB.", "error");
    imageInput.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    socket.emit("send_image", reader.result);
    appendImage(reader.result, "you", false);
  };
  reader.readAsDataURL(file);
  imageInput.value = "";
});

function appendImageRequest(src) {
  const div = document.createElement("div");
  div.className = "message stranger consent-msg";
  div.innerHTML = `<span>Partner sent an image.</span><div class="consent-buttons"><button class="btn-accept">View</button><button class="btn-deny">Deny</button></div>`;

  div.querySelector(".btn-accept").onclick = () => {
    div.remove();
    appendImage(src, "stranger", true);
  };
  div.querySelector(".btn-deny").onclick = () => {
    div.innerHTML = `<span style="opacity:0.6; font-style:italic;">Image declined.</span>`;
  };

  chatBox.insertBefore(div, typingIndicator);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function appendImage(src, sender, isBlurred) {
  const div = document.createElement("div");
  div.classList.add("message", sender);
  div.style.background = "transparent";
  div.style.padding = "0";
  div.style.boxShadow = "none";
  const wrapper = document.createElement("div");
  wrapper.classList.add("image-wrapper");
  if (isBlurred) wrapper.classList.add("blurred");
  const img = document.createElement("img");
  img.src = src;
  wrapper.appendChild(img);
  div.appendChild(wrapper);
  if (isBlurred)
    wrapper.addEventListener("click", () => {
      wrapper.classList.remove("blurred");
      wrapper.classList.add("revealed");
    });
  chatBox.insertBefore(div, typingIndicator);
  chatBox.scrollTop = chatBox.scrollHeight;
}
function appendMessage(text, sender) {
  const div = document.createElement("div");
  div.classList.add("message", sender);
  div.textContent = text;
  chatBox.insertBefore(div, typingIndicator);
  chatBox.scrollTop = chatBox.scrollHeight;
}
function appendSystemMessage(text) {
  const div = document.createElement("div");
  div.classList.add("system-message");
  div.textContent = text;
  chatBox.insertBefore(div, typingIndicator);
  chatBox.scrollTop = chatBox.scrollHeight;
}
function updateOverlay(title, subtitle, showRadar) {
  statusOverlay.style.display = "flex";
  overlayTitle.textContent = title;
  overlaySubtitle.textContent = subtitle;
  radarAnim.style.display = showRadar ? "block" : "none";
}
function hideOverlay() {
  statusOverlay.style.display = "none";
}
function toggleInputs(disabled) {
  interestsInput.disabled = disabled;
  nicknameInput.disabled = disabled;
  ageInput.disabled = disabled;
  genderInput.disabled = disabled;
  profileSection.style.opacity = disabled ? "0.5" : "1";
  profileSection.style.pointerEvents = disabled ? "none" : "auto";
  if (!disabled) matchInfo.style.display = "none";
}

// --- NEW SKIP LOGIC ---
function startFindingPartner() {
  let nickname = nicknameInput.value.trim();
  if (!nickname) {
    showToast("Nickname is required!", "error");
    nicknameInput.focus();
    return;
  }
  if (/\s/.test(nickname)) {
    showToast("Nickname must be one word!", "error");
    nicknameInput.focus();
    return;
  }

  localStorage.setItem("chat_nickname", nickname);
  localStorage.setItem("chat_age", ageInput.value);
  localStorage.setItem("chat_gender", genderInput.value);
  localStorage.setItem("chat_interests", interestsInput.value);

  const tags = interestsInput.value
    .split(",")
    .map((tag) => tag.trim())
    .filter((t) => t.length > 0);
  const profile = {
    nickname: nickname,
    age: ageInput.value,
    gender: genderInput.value,
  };

  socket.emit("find_partner", { tags: tags, profile: profile });
  setSearchingState(tags);
}

startBtn.addEventListener("click", startFindingPartner);

stopBtn.addEventListener("click", () => {
  if (isConnected) {
    // SKIP LOGIC (Disconnect -> Find New)
    socket.emit("disconnect_partner");

    // FIX: Tell the app we are no longer connected!
    isConnected = false;

    startFindingPartner();
  } else {
    // STOP LOGIC (Cancel Search)
    socket.emit("disconnect_partner");
    startBtn.style.display = "block";
    stopBtn.style.display = "none";
    headerStopBtn.style.display = "none";
    toggleInputs(false);
    profileSection.style.display = "flex";
    interestsSection.style.display = "block";
    updateOverlay(
      "Ready to Connect?",
      "Set your profile and start exploring.",
      false
    );
  }
});
// ----------------------

function setSearchingState(tags) {
  startBtn.style.display = "none";
  stopBtn.style.display = "block";
  headerStopBtn.style.display = "flex";

  // UI for Searching (Should say STOP, not SKIP)
  stopBtn.textContent = "Stop Searching";
  headerStopBtn.textContent = "✖️"; // Use 'X' for stop searching

  toggleInputs(true);
  profileSection.style.display = "flex";
  interestsSection.style.display = "block";
  chatBox
    .querySelectorAll(".message, .system-message")
    .forEach((msg) => msg.remove());
  updateOverlay(
    "Searching...",
    tags.length > 0
      ? `Looking for: ${tags.join(", ")}`
      : "Looking for a random partner...",
    true
  );
}

function setConnectedState(partnerProfile) {
  isConnected = true;
  hideOverlay();
  messageInput.disabled = false;
  sendBtn.disabled = false;
  icebreakerBtn.disabled = false;
  emojiBtn.disabled = false;
  cameraBtn.disabled = false;

  // UI for Chatting (Shows "Skip" option)
  stopBtn.textContent = "Skip ⏭️";
  headerStopBtn.textContent = "⏭️"; // Skip icon for next

  profileSection.style.display = "none";
  interestsSection.style.display = "none";
  let infoText = `Connected with: ${partnerProfile.nickname}`;
  if (partnerProfile.age || partnerProfile.gender)
    infoText += ` (${partnerProfile.gender || "?"} / ${
      partnerProfile.age || "?"
    })`;
  matchDetails.textContent = infoText;
  matchInfo.style.display = "block";
}

function handleDisconnectState(reason) {
  isConnected = false;
  messageInput.disabled = true;
  sendBtn.disabled = true;
  icebreakerBtn.disabled = true;
  emojiBtn.disabled = true;
  cameraBtn.disabled = true;
  emojiPopover.style.display = "none";

  // Reset buttons
  startBtn.style.display = "block";
  startBtn.textContent = "Find New Partner";
  startBtn.disabled = false;
  stopBtn.style.display = "none";
  headerStopBtn.style.display = "none";

  toggleInputs(false);
  profileSection.style.display = "flex";
  interestsSection.style.display = "block";
  typingIndicator.style.display = "none";
  appendSystemMessage(reason);
}

sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});
function sendMessage() {
  const msg = messageInput.value.trim();
  if (msg && isConnected) {
    socket.emit("send_message", msg);
    appendMessage(msg, "you");
    messageInput.value = "";
    emojiPopover.style.display = "none";
    socket.emit("stop_typing");
  }
}
messageInput.addEventListener("input", () => {
  if (!isConnected) return;
  socket.emit("typing");
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit("stop_typing");
  }, 1000);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (stopBtn.style.display !== "none") stopBtn.click();
    else if (!startBtn.disabled) startBtn.click();
  }
});

socket.on("user_count", (count) => {
  userCountSpan.textContent = count;
});
socket.on("match_found", (data) => {
  setConnectedState(data.partnerProfile || { nickname: "Stranger" });
  if (!isMuted) matchSound.play().catch((e) => {});
  showToast("Connected!", "success");
  if (data.tags && data.tags.length > 0)
    appendSystemMessage(`Common interests: ${data.tags.join(", ")}`);
});
socket.on("receive_message", (msg) => {
  typingIndicator.style.display = "none";
  appendMessage(msg, "stranger");
  if (!isMuted) msgSound.play().catch((e) => {});
});
socket.on("receive_image", (base64) => {
  typingIndicator.style.display = "none";
  appendImageRequest(base64);
  if (!isMuted) msgSound.play().catch((e) => {});
});
socket.on("partner_disconnected", () => {
  handleDisconnectState("Partner has disconnected.");
  showToast("Partner left.", "info");
});
socket.on("partner_typing", () => {
  typingIndicator.style.display = "flex";
  chatBox.scrollTop = chatBox.scrollHeight;
});
socket.on("partner_stop_typing", () => {
  typingIndicator.style.display = "none";
});
