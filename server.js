const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Chargement des mots depuis le fichier words.txt
let fileWords = [];
try {
  const fileContent = fs.readFileSync('words.txt', 'utf8');
  fileWords = fileContent
    .split('\n')
    .map(word => word.trim())
    .filter(word => word.length > 0);
  console.log(`Mots chargés depuis words.txt : ${fileWords.length} mots`);
} catch (error) {
  console.error("Erreur lors de la lecture de words.txt :", error.message);
  // Fallback : liste statique de mots
  fileWords = ['ordinateur', 'clavier', 'souris', 'écran', 'code', 'serveur', 'socket', 'client', 'variable', 'fonction'];
}

let players = {};         // Structure : { socketId: { name, score, ready } }
let masterId = null;      // ID du joueur maître (défini via "Créer partie")
let gameStarted = false;
let gameStartTime = null;
let currentWord = '';

// Diffuse la liste des joueurs et l'ID du maître
function broadcastPlayerList() {
  io.emit('updatePlayers', { players, masterId });
}

// Retourne un mot aléatoire depuis le tableau fileWords
function getRandomWord() {
  return fileWords[Math.floor(Math.random() * fileWords.length)];
}

io.on('connection', (socket) => {
  console.log('Un joueur connecté:', socket.id);
  // Ajoute le joueur avec des valeurs par défaut
  players[socket.id] = { name: 'Anonyme', score: 0, ready: false };

  broadcastPlayerList();

  // Le joueur envoie son nom
  socket.on('setName', (name) => {
    players[socket.id].name = name;
    broadcastPlayerList();
  });
  
  // Le joueur indique qu'il est prêt
  socket.on('playerReady', () => {
    players[socket.id].ready = true;
    broadcastPlayerList();
  });
  
  // Le joueur souhaite créer la partie et devenir maître
  socket.on('createGame', () => {
    if (!masterId) {
      masterId = socket.id;
      broadcastPlayerList();
    } else {
      socket.emit('errorMessage', 'Une partie a déjà été créée.');
    }
  });
  
  // Le maître lance la partie
  socket.on('startGame', () => {
    if (socket.id !== masterId) return; // seul le maître peut démarrer
    const allReady = Object.values(players).every(player => player.ready);
    if (!allReady) {
      socket.emit('errorMessage', 'Tous les joueurs ne sont pas prêts !');
      return;
    }
    gameStarted = true;
    gameStartTime = Date.now();
    currentWord = getRandomWord();
    io.emit('gameStart', { currentWord, startTime: gameStartTime });
    io.emit('updateScore', players);
  });
  
  // Lorsqu'un joueur tape un mot
  socket.on('wordTyped', (word) => {
    if (!gameStarted) return;
    if (word === currentWord) {
      players[socket.id].score++;
      if (players[socket.id].score >= 10) {
        // Envoie l'objet gameOver avec l'ID et le nom du gagnant
        io.emit('gameOver', { winnerId: socket.id, winnerName: players[socket.id].name });
        gameStarted = false;
        // Réinitialise scores et état "prêt" pour une nouvelle partie
        for (let id in players) {
          players[id].score = 0;
          players[id].ready = false;
        }
        broadcastPlayerList();
      } else {
        currentWord = getRandomWord();
        io.emit('newWord', currentWord);
        io.emit('updateScore', players);
      }
    }
  });
  
  socket.on('disconnect', () => {
    delete players[socket.id];
    if (socket.id === masterId) {
      // Si le maître se déconnecte, on réinitialise la partie
      masterId = null;
    }
    broadcastPlayerList();
  });
});

server.listen(3000, () => {
  console.log('Serveur lancé sur http://localhost:3000');
});
