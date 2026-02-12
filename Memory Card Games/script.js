const cards = document.querySelectorAll(".card");
const modeToggle = document.querySelector("#modeToggle");
const turnDisplay = document.querySelector("#turnDisplay");
const p1ScoreEl = document.querySelector("#p1Score");
const p2ScoreEl = document.querySelector("#p2Score");
const p2Stat = document.querySelector("#p2Stat");
const timeStat = document.querySelector("#timeStat");
const timeDisplay = document.querySelector("#timeDisplay");
const matchesDisplay = document.querySelector("#matchesDisplay");
const resetBtn = document.querySelector("#resetBtn");
const statusMessage = document.querySelector("#statusMessage");
const leaderboard = document.querySelector("#leaderboard");
const recordName = document.querySelector("#recordName");
const recordTime = document.querySelector("#recordTime");
const tutorialBtn = document.querySelector("#tutorialBtn");
const infoBtn = document.querySelector("#infoBtn");
const tutorialModal = document.querySelector("#tutorialModal");
const infoModal = document.querySelector("#infoModal");
const modalCloseButtons = document.querySelectorAll(".modal-close");

const RECORD_TIME_KEY = "mcg2_best_time_seconds";
const RECORD_NAME_KEY = "mcg2_best_name";

const totalPairs = cards.length / 2;

let mode = "single";
let currentPlayer = 1;
let scores = [0, 0];
let matchesFound = 0;
let firstCard = null;
let secondCard = null;
let lockBoard = false;
let elapsedSeconds = 0;
let timerId = null;
let isPlaying = false;

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function startTimer() {
  if (timerId) return;
  timerId = setInterval(() => {
    elapsedSeconds += 1;
    timeDisplay.textContent = formatTime(elapsedSeconds);
  }, 1000);
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function resetTimer() {
  stopTimer();
  elapsedSeconds = 0;
  timeDisplay.textContent = formatTime(elapsedSeconds);
  isPlaying = false;
}

function loadRecord() {
  const savedTime = parseInt(localStorage.getItem(RECORD_TIME_KEY), 10);
  const savedName = localStorage.getItem(RECORD_NAME_KEY);
  if (!isNaN(savedTime) && savedName) {
    recordName.textContent = savedName;
    recordTime.textContent = formatTime(savedTime);
  } else {
    recordName.textContent = "No record yet";
    recordTime.textContent = "--:--";
  }
}

function saveRecordIfBest() {
  const savedTime = parseInt(localStorage.getItem(RECORD_TIME_KEY), 10);
  if (isNaN(savedTime) || elapsedSeconds < savedTime) {
    const nameInput = prompt("New record! Enter your name:", "Player 1");
    const cleanedName = nameInput && nameInput.trim() ? nameInput.trim() : "Player 1";
    localStorage.setItem(RECORD_TIME_KEY, String(elapsedSeconds));
    localStorage.setItem(RECORD_NAME_KEY, cleanedName);
    loadRecord();
  }
}

function updateHud() {
  p1ScoreEl.textContent = scores[0];
  p2ScoreEl.textContent = scores[1];
  matchesDisplay.textContent = matchesFound;
  if (mode === "single") {
    turnDisplay.textContent = "Solo";
  } else {
    turnDisplay.textContent = `Player ${currentPlayer}`;
  }
}

function showStatus(message) {
  statusMessage.textContent = message;
}

function clearStatus() {
  statusMessage.textContent = "";
}

function resetBoard() {
  firstCard = null;
  secondCard = null;
  lockBoard = false;
}

function switchPlayer() {
  currentPlayer = currentPlayer === 1 ? 2 : 1;
  updateHud();
}

function handleMatch() {
  matchesFound += 1;
  scores[currentPlayer - 1] += 1;
  firstCard.classList.add("matched");
  secondCard.classList.add("matched");
  resetBoard();
  updateHud();

  if (matchesFound === totalPairs) {
    if (mode === "single") {
      stopTimer();
      showStatus("Great job! You matched all the cards.");
      saveRecordIfBest();
    } else {
      const winner = scores[0] === scores[1] ? "Tie game" : (scores[0] > scores[1] ? "Player 1 wins!" : "Player 2 wins!");
      showStatus(`Game over. ${winner}`);
    }
  }
}

function handleMismatch() {
  setTimeout(() => {
    firstCard.classList.add("shake");
    secondCard.classList.add("shake");
  }, 300);

  setTimeout(() => {
    firstCard.classList.remove("shake", "flip");
    secondCard.classList.remove("shake", "flip");
    resetBoard();
    if (mode === "duo") {
      switchPlayer();
    }
  }, 900);
}

function flipCard({ target: clickedCard }) {
  if (lockBoard || clickedCard === firstCard || clickedCard.classList.contains("matched")) {
    return;
  }

  if (!isPlaying && mode === "single") {
    isPlaying = true;
    startTimer();
  }

  clickedCard.classList.add("flip");

  if (!firstCard) {
    firstCard = clickedCard;
    return;
  }

  secondCard = clickedCard;
  lockBoard = true;

  const firstValue = firstCard.dataset.value;
  const secondValue = secondCard.dataset.value;

  if (firstValue === secondValue) {
    lockBoard = false;
    handleMatch();
  } else {
    handleMismatch();
  }
}

function shuffleCards() {
  const values = [];
  for (let i = 1; i <= totalPairs; i += 1) {
    values.push(i, i);
  }
  values.sort(() => (Math.random() > 0.5 ? 1 : -1));

  cards.forEach((card, index) => {
    card.classList.remove("flip", "matched", "shake");
    const value = values[index];
    const imgTag = card.querySelector(".back-view img");
    imgTag.src = `images/img-${value}.png`;
    card.dataset.value = String(value);
  });

  resetTimer();
  scores = [0, 0];
  matchesFound = 0;
  currentPlayer = 1;
  resetBoard();
  clearStatus();
  updateHud();
}

function updateMode() {
  mode = modeToggle.value;
  if (mode === "single") {
    p2Stat.classList.add("hidden");
    timeStat.classList.remove("hidden");
    leaderboard.classList.remove("hidden");
  } else {
    p2Stat.classList.remove("hidden");
    timeStat.classList.add("hidden");
    leaderboard.classList.add("hidden");
  }
  shuffleCards();
  if (mode === "single") {
    showStatus("Single player mode: beat the record time!");
  } else {
    showStatus("Two players: match to keep your turn.");
  }
}

function openModal(modal) {
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(modal) {
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

cards.forEach(card => {
  card.addEventListener("click", flipCard);
});

resetBtn.addEventListener("click", shuffleCards);
modeToggle.addEventListener("change", updateMode);

modalCloseButtons.forEach(button => {
  button.addEventListener("click", () => {
    const modalId = button.getAttribute("data-close");
    const modal = document.getElementById(modalId);
    if (modal) closeModal(modal);
  });
});

tutorialBtn.addEventListener("click", () => openModal(tutorialModal));
infoBtn.addEventListener("click", () => openModal(infoModal));

[tutorialModal, infoModal].forEach(modal => {
  modal.addEventListener("click", event => {
    if (event.target === modal) {
      closeModal(modal);
    }
  });
});

loadRecord();
updateMode();
