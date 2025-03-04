const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const words = ['ordinateur', 'clavier', 'souris', 'écran', 'code', 'serveur', 'socket', 'client', 'variable', 'fonction'];

let players = {};         // Structure : { socketId: { name, score, ready } }
let masterId = null;      // L'ID du joueur maître
let gameStarted = false;
let startTime = null;
let currentWord = '';

function broadcastPlayerList() {
  io.emit('updatePlayers', { players, masterId });
}

function getRandomWord() {
  return words[Math.floor(Math.random() * words.length)];
}

io.on('connection', (socket) => {
  console.log('Un joueur connecté:', socket.id);
  // Ajoute le joueur avec des valeurs par défaut
  players[socket.id] = { name: 'Anonyme', score: 0, ready: false };

  // Le premier joueur connecté devient le maître
  if (!masterId) {
    masterId = socket.id;
  }
  
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
  
  // Le maître lance la partie
  socket.on('startGame', () => {
    if (socket.id !== masterId) return; // seul le maître peut démarrer
    const allReady = Object.values(players).every(player => player.ready);
    if (!allReady) {
      socket.emit('errorMessage', 'Tous les joueurs ne sont pas prêts !');
      return;
    }
    gameStarted = true;
    startTime = Date.now();
    currentWord = getRandomWord();
    io.emit('gameStart', { currentWord, startTime });
    io.emit('updateScore', players);
  });
  
  // Lorsqu'un joueur tape un mot
  socket.on('wordTyped', (word) => {
    if (!gameStarted) return;
    if (word === currentWord) {
      players[socket.id].score++;
      if (players[socket.id].score >= 10) {
        io.emit('gameOver', socket.id);
        gameStarted = false;
        // Réinitialise scores et état "prêt" pour une éventuelle nouvelle partie
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
      const ids = Object.keys(players);
      masterId = ids.length > 0 ? ids[0] : null;
    }
    broadcastPlayerList();
  });
});

server.listen(3000, () => {
  console.log('Serveur lancé sur http://localhost:3000');
});
