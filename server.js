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

// --------------------
// Create room
// --------------------
app.post("/rooms", (req, res) => {
  const code = makeRoomCode();
  rooms.set(code, {
    code,
    bank: 20580,
    players: []
  });
  res.json({ code });
});

// --------------------
// Join room
// --------------------
app.post("/rooms/:code/join", (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms.get(code);

  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  const name = (req.body?.name || "").trim();
  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  const player = {
    id: Math.random().toString(36).slice(2, 10),
    name,
    balance: 1500
  };

  room.players.push(player);
  res.json({ ok: true, player, room });
});

// --------------------
// Get room state
// --------------------
app.get("/rooms/:code", (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms.get(code);

  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  res.json({ ok: true, room });
});

// --------------------
// Transfer money
// --------------------
app.post("/rooms/:code/transfer", (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms.get(code);

  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  let { from, to, amount } = req.body;
amount = Number(amount);

if (!from || !to || isNaN(amount) || amount <= 0) {
  return res.status(400).json({ error: "Invalid transfer data" });
}

  // BANK → PLAYER
  if (from === "bank") {
    const player = room.players.find(p => p.id === to);
    if (!player) return res.status(404).json({ error: "Player not found" });
    if (room.bank < amount) {
      return res.status(400).json({ error: "Bank has insufficient funds" });
    }

    room.bank -= amount;
    player.balance += amount;
    return res.json({ ok: true, room });
  }

  // PLAYER → BANK
  if (to === "bank") {
    const player = room.players.find(p => p.id === from);
    if (!player) return res.status(404).json({ error: "Player not found" });
    if (player.balance < amount) {
      return res.status(400).json({ error: "Player has insufficient funds" });
    }

    player.balance -= amount;
    room.bank += amount;
    return res.json({ ok: true, room });
  }

  // PLAYER → PLAYER
  const fromPlayer = room.players.find(p => p.id === from);
  const toPlayer = room.players.find(p => p.id === to);

  if (!fromPlayer) {
    return res.status(404).json({ error: "From player not found" });
  }
  if (!toPlayer) {
    return res.status(404).json({ error: "To player not found" });
  }
  if (fromPlayer.balance < amount) {
    return res.status(400).json({ error: "Player has insufficient funds" });
  }

  fromPlayer.balance -= amount;
  toPlayer.balance += amount;

  res.json({ ok: true, room });
});

// --------------------
// Start server
// --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});