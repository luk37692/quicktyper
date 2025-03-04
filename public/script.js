const socket = io();
let mySocketId = null;
socket.on('connect', () => {
    mySocketId = socket.id;
});

// --- Éléments de la salle d'attente ---
const waitingRoom = document.getElementById('waitingRoom');
const playerNameInput = document.getElementById('playerName');
const setNameBtn = document.getElementById('setNameBtn');
const createGameBtn = document.getElementById('createGameBtn');
const readyBtn = document.getElementById('readyBtn');
const masterControls = document.getElementById('masterControls');
const startGameBtn = document.getElementById('startGameBtn');
const playersList = document.getElementById('playersList');
const errorMessage = document.getElementById('errorMessage');

// --- Éléments de la partie ---
const gameContainer = document.getElementById('gameContainer');
const timerDisplay = document.getElementById('timer');
const wordDisplay = document.getElementById('word');
const gameInput = document.getElementById('gameInput');
const scoreboard = document.getElementById('scoreboard');

// --- Message de victoire/défaite et animation des feux d'artifice ---
const winnerMessage = document.getElementById('winnerMessage');
const canvas = document.getElementById('fireworksCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

// --- Code des feux d'artifice ---
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.radius = Math.random() * 2 + 1;
    this.speed = Math.random() * 5 + 2;
    this.angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(this.angle) * this.speed;
    this.vy = Math.sin(this.angle) * this.speed;
    this.alpha = 1;
    this.decay = Math.random() * 0.03 + 0.01;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= this.decay;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.restore();
  }
}
let particles = [];
function createFirework(x, y) {
  const colors = ["#ff0043", "#14fc56", "#1e90ff", "#ffae00", "#ffff00"];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const numParticles = 50;
  for (let i = 0; i < numParticles; i++) {
    particles.push(new Particle(x, y, color));
  }
}
function animateFireworks() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update();
    p.draw(ctx);
    if (p.alpha <= 0) {
      particles.splice(i, 1);
    }
  }
  requestAnimationFrame(animateFireworks);
}
function startFireworks() {
  animateFireworks();
  const interval = setInterval(() => {
      createFirework(Math.random() * canvas.width, Math.random() * canvas.height * 0.5);
  }, 300);
  setTimeout(() => { clearInterval(interval); }, 5000);
}

// --- Gestion du timer avec centièmes ---
let startTime = null;
let timerInterval = null;
function startTimer(startTimestamp) {
    startTime = startTimestamp;
    timerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const seconds = Math.floor(elapsed / 1000);
        const centiseconds = Math.floor((elapsed % 1000) / 10);
        timerDisplay.textContent = `Temps: ${seconds}.${centiseconds.toString().padStart(2, '0')} s`;
    }, 10);
}

// --- Événements de la salle d'attente ---
setNameBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if(name) {
        socket.emit('setName', name);
    }
});
createGameBtn.addEventListener('click', () => {
    socket.emit('createGame');
});
readyBtn.addEventListener('click', () => {
    socket.emit('playerReady');
});
startGameBtn.addEventListener('click', () => {
    socket.emit('startGame');
});

// Met à jour la liste des joueurs dans la salle d'attente
socket.on('updatePlayers', (data) => {
    const { players, masterId } = data;
    let html = '<h2>Joueurs connectés</h2>';
    for (let id in players) {
        const p = players[id];
        html += `<p>${p.name} ${id === masterId ? '(Maître)' : ''} - ${p.ready ? 'Prêt' : 'En attente'} - Mots validés: ${p.score}</p>`;
    }
    playersList.innerHTML = html;
    // Affiche le bouton "Créer partie" si aucun maître n'est défini
    if (masterId === null) {
      createGameBtn.style.display = 'block';
      masterControls.style.display = 'none';
    } else {
      createGameBtn.style.display = 'none';
      if (mySocketId === masterId) {
        masterControls.style.display = 'block';
      } else {
        masterControls.style.display = 'none';
      }
    }
});

// Gestion des messages d'erreur
socket.on('errorMessage', (msg) => {
    errorMessage.textContent = msg;
    setTimeout(() => { errorMessage.textContent = ''; }, 3000);
});

// --- Événements de la partie ---
socket.on('gameStart', (data) => {
    const { currentWord, startTime: gameStartTime } = data;
    waitingRoom.style.display = 'none';
    gameContainer.style.display = 'flex';
    wordDisplay.textContent = currentWord;
    gameInput.value = '';
    startTimer(gameStartTime);
});
socket.on('newWord', (word) => {
    wordDisplay.textContent = word;
    gameInput.value = '';
    wordDisplay.style.animation = 'none';
    wordDisplay.offsetHeight; // Forcer le reflow pour relancer l'animation
    wordDisplay.style.animation = 'fadeIn 1s forwards';
});
socket.on('updateScore', (players) => {
    let html = '<h2>Scores</h2>';
    for (let id in players) {
        html += `<p>${players[id].name}: ${players[id].score} mots</p>`;
    }
    scoreboard.innerHTML = html;
});
socket.on('gameOver', (data) => {
    clearInterval(timerInterval);
    // data contient winnerId et winnerName
    if (mySocketId === data.winnerId) {
        winnerMessage.textContent = `Vous avez gagné ! Félicitations ${data.winnerName} 🎉`;
    } else {
        winnerMessage.textContent = `Défaite... ${data.winnerName} a gagné la partie.`;
    }
    winnerMessage.style.display = 'block';
    startFireworks();
    setTimeout(() => { location.reload(); }, 7000);
});

// Envoi du mot tapé lors de la pression sur "Entrée"
gameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        socket.emit('wordTyped', gameInput.value.trim());
    }
});
