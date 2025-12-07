import { useState, useEffect } from "react";
import { createGame, placePiece, movePiece, getGame, registerPlayer } from "./api";

const COLOR_PURPLE = "#a855f7";
const COLOR_YELLOW = "#facc15";

function getSideColors(gameId) {
  // top side (Player2) is always yellow
  // bottom side (Player1) is always purple
  return {
    Player1: COLOR_PURPLE, // bottom
    Player2: COLOR_YELLOW, // top
  };
}

function getAssignedSide(gameId, role) {
  if (!gameId) return null; // role is "host" or "guest"

  // simple deterministic decision based on game id
  const hex = gameId.replace(/-/g, "");
  const first = parseInt(hex[0], 16);
  const hostIsPlayer1 = first % 2 === 0;

  if (role === "host") {
    return hostIsPlayer1 ? "Player1" : "Player2";
  }
  if (role === "guest") {
    return hostIsPlayer1 ? "Player2" : "Player1";
  }

  return null;
}

function sideLabel(side, sideColors) {
  if (!side) return "";
  if (side === "Player1") return "Purple player";
  if (side === "Player2") return "Yellow player";
  return side;
}

function cellDisplay(cell) {
  if (!cell) return "·";
  const letter = cell.type[0];
  return letter.toUpperCase();
}

function App() {
 const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedPiece, setSelectedPiece] = useState("Elephant");
  const [selectedFrom, setSelectedFrom] = useState(null);
  const [joinId, setJoinId] = useState("");

  const [mySide, setMySide] = useState(null); // "Player1" or "Player2"
  const [myName, setMyName] = useState("");   // local name only

  useEffect(() => {
    if (!game || !game.id) return;
    if (game.winner) return; // stop refreshing after win

    const gameId = game.id;

    const interval = setInterval(async () => {
      try {
        const fresh = await getGame(gameId);
        setGame(fresh);
      } catch (err) {
        console.error("Polling getGame failed, ", err);
        // do not set error here, so we do not spam the UI
      }
    }, 1000); // every second

    return () => clearInterval(interval);
  }, [game?.id, game?.winner]);

  async function handleCreateGame() {
    try {
      setLoading(true);
      setError("");
      setSelectedFrom(null);
      setJoinId("");
      const data = await createGame();
      setGame(data);

      const side = getAssignedSide(data.id, "host");
      setMySide(side);

      const nameToSend = myName.trim();
      if (nameToSend) {
        try {
          const updated = await registerPlayer(data.id, side, nameToSend);
          setGame(updated); // update game to include Player1Name / Player2Name
        } catch (e) {
          console.error("registerPlayer (host) failed, ", e);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinGame() {
    try {
      setError("");

      const trimmed = joinId.trim();
      if (!trimmed) {
        setError("Enter a game id first");
        return;
      }

      const data = await getGame(trimmed);
      setGame(data);
      setSelectedFrom(null);

      const side = getAssignedSide(data.id, "guest");
      setMySide(side);

      const nameToSend = myName.trim();
      if (nameToSend) {
        try {
          const updated = await registerPlayer(data.id, side, nameToSend);
          setGame(updated);
        } catch (e) {
          console.error("registerPlayer (guest) failed, ", e);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to join game");
    }
  }

  async function handleCellClick(row, col) {
    if (!game) return;

    if (game.winner) {
      return;
    }

      // Placement phase, both players can place, but only on their own side
    if (game.status === "Placement") {
      const size = game.cells.length;

      if (mySide === "Player1") {
        // Player1 is bottom side, last two rows
        if (row < size - 2) {
          setError("You can place pieces only on your two bottom rows");
          return;
        }
      } else if (mySide === "Player2") {
        // Player2 is top side, first two rows
        if (row > 1) {
          setError("You can place pieces only on your two top rows");
          return;
        }
      }

      try {
        setError("");
        const updated = await placePiece(game.id, selectedPiece, row, col);
        setGame(updated);
      } catch (err) {
        console.error(err);
        setError(err.message || "Placement failed");
      }
      return;
    }


    // In-progress phase, now turns matter
    if (game.status === "InProgress") {
      if (mySide && mySide !== game.currentPlayer) {
        setError("It is not your turn");
        return;
      }

      const cell = game.cells[row]?.[col];

      if (!selectedFrom) {
        if (!cell) {
          setError("Select one of your own pieces first");
          return;
        }
        if (cell.owner !== game.currentPlayer) {
          setError("You can move only your own pieces");
          return;
        }

        setSelectedFrom({ row, col });
        setError("");
        return;
      }

      if (selectedFrom.row === row && selectedFrom.col === col) {
        setSelectedFrom(null);
        setError("");
        return;
      }

      if (cell && cell.owner === game.currentPlayer) {
        setSelectedFrom({ row, col });
        setError("");
        return;
      }

      try {
        setError("");
        const updated = await movePiece(
          game.id,
          selectedFrom.row,
          selectedFrom.col,
          row,
          col
        );
        setGame(updated);
        setSelectedFrom(null);
      } catch (err) {
        console.error(err);
        setError(err.message || "Move failed");
      }
    }
  }

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        overflow: "auto",
        padding: "1rem",
        fontFamily: "system-ui, sans-serif",
        background: "#0f172a",
        color: "white",
      }}
    >

      <h1>Roy s Flag Game</h1>

      <button
        onClick={handleCreateGame}
        disabled={loading}
        style={{
          padding: "0.5rem 1rem",
          borderRadius: "0.5rem",
          border: "none",
          fontSize: "1rem",
          cursor: "pointer",
          background: "#22c55e",
        }}
      >
        {loading ? "Creating..." : "Create new game"}
      </button>

      <div style={{ marginTop: "0.5rem" }}>
        <input
          value={joinId}
          onChange={(e) => setJoinId(e.target.value)}
          placeholder="Paste game id to join"
          style={{
            width: "280px",
            padding: "0.25rem 0.5rem",
            borderRadius: "0.375rem",
            border: "1px solid #4b5563",
            background: "#020617",
            color: "white",
          }}
        />

        <button
          onClick={handleJoinGame}
          style={{
            marginLeft: "0.5rem",
            padding: "0.25rem 0.75rem",
            borderRadius: "0.5rem",
            border: "none",
            cursor: "pointer",
            background: "#38bdf8",
          }}
        >
          Join game
        </button>
      </div>

            <div style={{ marginTop: "0.75rem" }}>
        <input
          value={myName}
          onChange={(e) => setMyName(e.target.value)}
          placeholder="Your name"
          style={{
            width: "280px",
            padding: "0.25rem 0.5rem",
            borderRadius: "0.375rem",
            border: "1px solid #4b5563",
            background: "#020617",
            color: "white",
          }}
        />
      </div>

            {mySide && game && (
        <div style={{ marginTop: "0.5rem" }}>
          <span>You are </span>
          {(() => {
            const sideColors = getSideColors(game.id);
            const color =
              mySide === "Player1"
                ? sideColors.Player1
                : sideColors.Player2;
            const label =
              myName.trim() ||
              sideLabel(mySide, sideColors);

            return (
              <span
                style={{
                  color,
                  fontWeight: "bold",
                }}
              >
                {label}
              </span>
            );
          })()}
        </div>
      )}

      {game && game.status === "Placement" && (
        <div style={{ marginTop: "0.5rem" }}>
         <div style={{ marginBottom: "0.25rem" }}>
            Both players are placing pieces, no turns yet
          </div>
          <label style={{ marginRight: "0.5rem" }}>Select piece, </label>
          <select
            value={selectedPiece}
            onChange={(e) => setSelectedPiece(e.target.value)}
          >
            <option value="Elephant">Elephant</option>
            <option value="Tiger">Tiger</option>
            <option value="Mouse">Mouse</option>
            <option value="Scorpion">Scorpion</option>
          </select>
        </div>
      )}

      {game && game.status === "InProgress" && (
        <div style={{ marginTop: "0.5rem" }}>
          {selectedFrom ? (
            <span>
              Moving from, ({selectedFrom.row}, {selectedFrom.col})  click
              destination
            </span>
          ) : (
            <span>Select one of your pieces to move</span>
          )}
        </div>
      )}

      {error && (
        <div
          style={{
            background: "#b91c1c",
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            marginTop: "0.5rem",
          }}
        >
          {error}
        </div>
      )}

      {game && (
        <div style={{ marginTop: "1rem", width: "fit-content" }}>
          <div style={{ marginBottom: "0.25rem" }}>
            <strong>Game id: </strong> {game.id}
          </div>
        <div style={{ marginBottom: "0.25rem" }}>
          <strong>Current player: </strong>
          {(() => {
            const sideColors = getSideColors(game.id);
            const color =
              game.currentPlayer === "Player1"
                ? sideColors.Player1
                : game.currentPlayer === "Player2"
                ? sideColors.Player2
                : "white";

            const p1Name =
              (game.player1Name || "").trim() || sideLabel("Player1", sideColors);
            const p2Name =
              (game.player2Name || "").trim() || sideLabel("Player2", sideColors);

            const label =
              game.currentPlayer === "Player1"
                ? p1Name
                : game.currentPlayer === "Player2"
                ? p2Name
                : sideLabel(game.currentPlayer, sideColors);

            return (
              <>
                <span style={{ color }}>{label}</span>
                {mySide && mySide === game.currentPlayer && (
                  <span
                    style={{
                      marginLeft: "0.5rem",
                      fontSize: "0.85rem",
                      opacity: 0.9,
                    }}
                  >
                    (your turn)
                  </span>
                )}
              </>
            );
          })()}
        </div>

          <div style={{ marginBottom: "0.75rem" }}>
            <strong>Status: </strong> {game.status}
          </div>
          {(() => {
            const sideColors = getSideColors(game.id);
            const p1Color = sideColors.Player1;
            const p2Color = sideColors.Player2;
            const p1Name = (game.player1Name || "").trim() || sideLabel("Player1", sideColors);
            const p2Name = (game.player2Name || "").trim() || sideLabel("Player2", sideColors);

            return (
              <div
                style={{
                  marginBottom: "0.5rem",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1.5rem",
                  fontSize: "0.9rem",
                }}
              >
                <div>
                  <span style={{ color: p1Color, fontWeight: "bold" }}>{p1Name}</span>
                  <span style={{ marginLeft: "0.25rem" }}>bottom (purple side)</span>
                </div>
                <div>
                  <span style={{ color: p2Color, fontWeight: "bold" }}>{p2Name}</span>
                  <span style={{ marginLeft: "0.25rem" }}>top (yellow side)</span>
                </div>
              </div>
            );
          })()}

          {game.winner && (() => {
            const sideColors = getSideColors(game.id);
            const winnerColor =
              game.winner === "Player1"
                ? sideColors.Player1
                : sideColors.Player2;

            // Get the winning player's real name
            const winnerName =
              game.winner === "Player1"
                ? (game.player1Name?.trim() || "Player 1")
                : (game.player2Name?.trim() || "Player 2");

            return (
              <div
                style={{
                  marginBottom: "0.75rem",
                  padding: "0.5rem 1rem",
                  borderRadius: "0.5rem",
                  background: "#020617",
                  border: `2px solid ${winnerColor}`,
                  color: winnerColor,
                  fontWeight: "bold",
                }}
              >
                {winnerName} won
              </div>
            );
          })()}

        {(() => {
          const sideColors = getSideColors(game.id);

          return (
            <BoardView
              cells={game.cells}
              onCellClick={handleCellClick}
              selectedFrom={selectedFrom}
              player1Flag={game.player1Flag}
              player2Flag={game.player2Flag}
              sideColors={sideColors}
            />
          );
        })()}
        </div>
      )}
    </div>
  );
}

function Hearts({ lives }) {
  const maxLives = 3;
  const hearts = [];

  for (let i = 0; i < maxLives; i++) {
    const filled = i < lives;
    hearts.push(
      <span
        key={i}
        style={{
          opacity: filled ? 1 : 0.2,
          marginLeft: i === 0 ? 0 : 2,
        }}
      >
        ❤
      </span>
    );
  }

  return (
    <div
      style={{
        fontSize: "0.7rem",
        marginTop: 2,
        color: "#ef4444", // bright red
      }}
    >
      {hearts}
    </div>
  );
}

function BoardView({ cells, onCellClick, selectedFrom, player1Flag, player2Flag, sideColors }) {
  if (!cells) return null;

  const size = cells.length;
  const cellSize = 40;
  const gap = 4;
  const padding = 6;

  const boardWidth = padding * 2 + size * cellSize + (size - 1) * gap;
  const boardHeight = padding * 2 + size * cellSize + (size - 1) * gap;

  // Player colors from mapping (fallback to defaults)
  const player1Color = sideColors?.Player1 ?? COLOR_PURPLE;
  const player2Color = sideColors?.Player2 ?? COLOR_YELLOW;


  // home positions, middle of first / last row
  const player1Home = { row: size - 1, col: Math.floor(size / 2) }; // bottom middle
  const player2Home = { row: 0, col: Math.floor(size / 2) };        // top middle

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        width: boardWidth,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${size}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${size}, ${cellSize}px)`,
          gap: `${gap}px`,
          background: "#1e293b",
          padding: `${padding}px`,
          borderRadius: "0.75rem",
        }}
      >
        {cells.map((row, r) =>
          row.map((cell, c) => {
            const text = cellDisplay(cell);
            const isP1 = cell && cell.owner === "Player1";
            const isSelected =
              selectedFrom && selectedFrom.row === r && selectedFrom.col === c;

            // background based on owner color
            const bg = cell
              ? isP1
                ? "#4c1d95" // darker purple for Player1
                : "#d9df13ff" // darker yellow brown for Player2
              : "#020617";

            const borderColor = isSelected ? "#ffffff" : "#1f2937";
            const borderWidth = isSelected ? "3px" : "1px";

            // carried enemy flag color
            let carriedFlagColor = null;
            if (cell && cell.hasEnemyFlag) {
              carriedFlagColor =
                cell.owner === "Player1" ? player2Color : player1Color;
            }

            // ground flag in this cell (dropped or sitting), but NOT at home
            let groundFlagColor = null;
            const isP1FlagHere =
              player1Flag &&
              player1Flag.onBoard &&
              player1Flag.row === r &&
              player1Flag.col === c;
            const isP2FlagHere =
              player2Flag &&
              player2Flag.onBoard &&
              player2Flag.row === r &&
              player2Flag.col === c;

            const isP1HomeHere =
              r === player1Home.row && c === player1Home.col;
            const isP2HomeHere =
              r === player2Home.row && c === player2Home.col;

            // only show ground flag inside the cell when it is not at home
            if (isP1FlagHere && !isP1HomeHere) {
              groundFlagColor = player1Color;
            } else if (isP2FlagHere && !isP2HomeHere) {
              groundFlagColor = player2Color;
            }

            return (
              <div
                key={`${r}-${c}`}
                onClick={() => onCellClick && onCellClick(r, c)}
                style={{
                  width: `${cellSize}px`,
                  height: `${cellSize}px`,
                  borderRadius: "0.5rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                  border: `${borderWidth} solid ${borderColor}`,
                  background: bg,
                  boxShadow: isSelected
                    ? "0 0 10px rgba(255,255,255,0.9)"
                    : cell
                      ? "0 0 6px rgba(15,23,42,0.6)"
                      : "0 0 2px rgba(15,23,42,0.4)",
                  cursor: "pointer",
                  position: "relative",
                  color: "white",
                }}
              >
                {cell ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      lineHeight: 1,
                    }}
                  >
                    <span>{text}</span>
                    <Hearts lives={cell.lives} />
                  </div>
                ) : (
                  <span>{text}</span>
                )}

                {/* flag being carried by a piece */}
                {carriedFlagColor && (
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      right: 2,
                      fontSize: "0.85rem",
                      color: carriedFlagColor,
                      textShadow: "0 0 2px black",
                    }}
                  >
                    ⚑
                  </span>
                )}

                {/* ground flag sitting in this cell (after drop), not at home */}
                {groundFlagColor && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: 2,
                      right: 2,
                      fontSize: "0.85rem",
                      color: groundFlagColor,
                      textShadow: "0 0 2px black",
                    }}
                  >
                    ⚑
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Player2 home flag on ground, show ABOVE the board only while at home */}
      {player2Flag &&
        player2Flag.onBoard &&
        player2Flag.row === player2Home.row &&
        player2Flag.col === player2Home.col && (
          <span
            style={{
              position: "absolute",
              top: -16,
              left:
                padding +
                player2Flag.col * (cellSize + gap) +
                cellSize / 2,
              transform: "translateX(-50%)",
              fontSize: "0.9rem",
              color: player2Color,
              textShadow: "0 0 2px black",
            }}
          >
            ⚑
          </span>
        )}

      {/* Player1 home flag on ground, show BELOW the board only while at home */}
      {player1Flag &&
        player1Flag.onBoard &&
        player1Flag.row === player1Home.row &&
        player1Flag.col === player1Home.col && (
          <span
            style={{
              position: "absolute",
              top: boardHeight + 4,
              left:
                padding +
                player1Flag.col * (cellSize + gap) +
                cellSize / 2,
              transform: "translateX(-50%)",
              fontSize: "0.9rem",
              color: player1Color,
              textShadow: "0 0 2px black",
            }}
          >
            ⚑
          </span>
        )}
    </div>
  );
}

export default App;
