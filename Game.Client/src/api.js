const API_BASE = "http://localhost:5000/api";

export async function createGame() {
  const url = `${API_BASE}/games`;
  console.log("Calling createGame, ", url);

  const res = await fetch(url, {
    method: "POST",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CreateGame failed, ${res.status} ${text}`);
  }

  return await res.json();
}

export async function placePiece(gameId, pieceType, row, col) {
  const url = `${API_BASE}/games/${gameId}/place`;
  console.log("Calling placePiece, ", url, pieceType, row, col);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pieceType,
      row,
      col,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `placePiece failed, ${res.status}`);
  }

  return await res.json();
}

export async function movePiece(gameId, fromRow, fromCol, toRow, toCol) {
  const url = `${API_BASE}/games/${gameId}/move`;
  console.log("Calling movePiece, ", url, fromRow, fromCol, toRow, toCol);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fromRow,
      fromCol,
      toRow,
      toCol,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `movePiece failed, ${res.status}`);
  }

  return await res.json();
}

export async function getGame(gameId) {
  const url = `${API_BASE}/games/${gameId}`;
  console.log("Calling getGame, ", url);

  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `getGame failed, ${res.status}`);
  }

  return await res.json();
}

export async function registerPlayer(gameId, side, name) {
  const url = `${API_BASE}/games/${gameId}/register`;
  console.log("Calling registerPlayer, ", url, side, name);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ side, name }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `registerPlayer failed, ${res.status}`);
  }

  return await res.json();
}


