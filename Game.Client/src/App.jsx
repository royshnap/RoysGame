import { useState } from "react";
import { createGame, placePiece, movePiece } from "./api";

const PLAYER1_COLOR = "#a855f7"; // purple
const PLAYER2_COLOR = "#facc15"; // yellow

function formatPlayerName(name) {
  if (!name) return "";
  if (name === "Player1") return "Purple player";
  if (name === "Player2") return "Yellow player";
  return name;
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
  const [selectedFrom, setSelectedFrom] = useState(null); // { row, col } when moving

  async function handleCreateGame() {
    try {
      setLoading(true);
      setError("");
      setSelectedFrom(null);
      const data = await createGame();
      setGame(data);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCellClick(row, col) {
    if (!game) return;

    if (game.winner) {
      return;
    }

    if (game.status === "Placement") {
      // placement phase, clicks place new pieces
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

    if (game.status === "InProgress") {
      const cell = game.cells[row]?.[col];

      // no source selected yet, this click selects a piece to move
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

      // clicking the same cell again cancels selection
      if (selectedFrom.row === row && selectedFrom.col === col) {
        setSelectedFrom(null);
        setError("");
        return;
      }

      // clicking another of your own pieces changes the selection
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
        setSelectedFrom(null); // clear selection after move
      } catch (err) {
        console.error(err);
        setError(err.message || "Move failed");
      }
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: "1rem",
        padding: "1.5rem",
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

      {game && game.status === "Placement" && (
        <div style={{ marginTop: "0.5rem" }}>
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
            <strong>Game id, </strong> {game.id}
          </div>
          <div style={{ marginBottom: "0.25rem" }}>
            <strong>Current player, </strong> {game.currentPlayer}
          </div>
          <div style={{ marginBottom: "0.75rem" }}>
            <strong>Status, </strong> {game.status}
          </div>

        {game.winner && (() => {
          const winnerColor =
            game.winner === "Player1" ? PLAYER1_COLOR :
            game.winner === "Player2" ? PLAYER2_COLOR :
            "#22c55e";

          const label = formatPlayerName(game.winner);

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
              {label} won
            </div>
          );
        })()}

        <BoardView
          cells={game.cells}
          onCellClick={handleCellClick}
          selectedFrom={selectedFrom}
          player1Flag={game.player1Flag}
          player2Flag={game.player2Flag}
        />
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

function BoardView({ cells, onCellClick, selectedFrom, player1Flag, player2Flag }) {
  if (!cells) return null;

  const size = cells.length;
  const cellSize = 40;
  const gap = 4;
  const padding = 6;

  const boardWidth = padding * 2 + size * cellSize + (size - 1) * gap;
  const boardHeight = padding * 2 + size * cellSize + (size - 1) * gap;

  // Player colors
  const player1Color = "#a855f7"; // purple
  const player2Color = "#facc15"; // yellow

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
