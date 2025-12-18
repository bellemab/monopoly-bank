const express = require("express");
const app = express();

app.use(express.json());
app.use(express.static("public"));

// --------------------
// In-memory storage
// --------------------
const rooms = new Map();

function makeRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function pushHistory(room, entry) {
  room.history.unshift({
    time: Date.now(),
    ...entry
  });
  room.history = room.history.slice(0, 50); // keep last 50
}

// --------------------
// Create room
// --------------------
app.post("/rooms", (req, res) => {
  const code = makeRoomCode();
  rooms.set(code, {
    code,
    bank: 9999999999999,
    parking: 0,
    players: [],
    history: []
  });
  res.json({ code });
});

// --------------------
// Join room
// --------------------
app.post("/rooms/:code/join", (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms.get(code);
  if (!room) return res.status(404).json({ error: "Room not found" });

  const name = (req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Name required" });

  const player = {
    id: Math.random().toString(36).slice(2, 10),
    name,
    balance: 1500
  };

  room.players.push(player);

  pushHistory(room, {
    type: "join",
    text: `${name} joined the game`
  });

  res.json({ ok: true, player, room });
});

// --------------------
// Get room state
// --------------------
app.get("/rooms/:code", (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: "Room not found" });
  res.json({ ok: true, room });
});

// --------------------
// Transfers
// --------------------
app.post("/rooms/:code/transfer", (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: "Room not found" });

  const { from, to, amount } = req.body;
  if (!from || !to || typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ error: "Invalid transfer" });
  }

  // BANK → PLAYER
  if (from === "bank") {
    const player = room.players.find(p => p.id === to);
    if (!player) return res.status(404).json({ error: "Player not found" });

    player.balance += amount;

    pushHistory(room, {
      type: "bank",
      text: `Bank → ${player.name} ($${amount})`
    });

    return res.json({ ok: true, room });
  }

  // PLAYER → BANK
  if (to === "bank") {
    const player = room.players.find(p => p.id === from);
    if (!player) return res.status(404).json({ error: "Player not found" });
    if (player.balance < amount) {
      return res.status(400).json({ error: "Insufficient funds" });
    }

    player.balance -= amount;
    room.bank += amount;

    pushHistory(room, {
      type: "bank",
      text: `${player.name} → Bank ($${amount})`
    });

    return res.json({ ok: true, room });
  }

  // PLAYER → PLAYER
  const fromPlayer = room.players.find(p => p.id === from);
  const toPlayer = room.players.find(p => p.id === to);
  if (!fromPlayer || !toPlayer) {
    return res.status(404).json({ error: "Player not found" });
  }
  if (fromPlayer.balance < amount) {
    return res.status(400).json({ error: "Insufficient funds" });
  }

  fromPlayer.balance -= amount;
  toPlayer.balance += amount;

  pushHistory(room, {
    type: "transfer",
    text: `${fromPlayer.name} → ${toPlayer.name} ($${amount})`
  });

  res.json({ ok: true, room });
});

// --------------------
// Free Parking: Pay in
// --------------------
app.post("/rooms/:code/parking/pay", (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: "Room not found" });

  const { playerId, amount } = req.body;
  const player = room.players.find(p => p.id === playerId);
  if (!player) return res.status(404).json({ error: "Player not found" });
  if (player.balance < amount) {
    return res.status(400).json({ error: "Insufficient funds" });
  }

  player.balance -= amount;
  room.parking += amount;

  pushHistory(room, {
    type: "parking",
    text: `${player.name} → Free Parking ($${amount})`
  });

  res.json({ ok: true, room });
});

// --------------------
// Free Parking: Collect pot
// --------------------
app.post("/rooms/:code/parking/collect", (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: "Room not found" });

  const { playerId } = req.body;
  const player = room.players.find(p => p.id === playerId);
  if (!player) return res.status(404).json({ error: "Player not found" });

  const pot = room.parking;
  room.parking = 0;
  player.balance += pot;

  pushHistory(room, {
    type: "parking",
    text: `${player.name} collected Free Parking ($${pot})`
  });

  res.json({ ok: true, room });
});

// --------------------
// Start server
// --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on ${PORT}`);
});