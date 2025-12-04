import { useState } from "react";
import { createGame, placePiece, movePiece } from "./api";

function cellDisplay(cell) {
  if (!cell) return "·";

  // first letter of the piece type, E, T, M
  const letter = cell.type[0];

  // Player1 uppercase, Player2 lowercase
  return cell.owner === "Player1" ? letter.toUpperCase() : letter.toLowerCase();
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

          <BoardView
            cells={game.cells}
            onCellClick={handleCellClick}
            selectedFrom={selectedFrom}
          />
        </div>
      )}
    </div>
  );
}

function BoardView({ cells, onCellClick, selectedFrom }) {
  if (!cells) return null;

  const size = cells.length;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${size}, 40px)`,
        gridTemplateRows: `repeat(${size}, 40px)`,
        gap: "4px",
        background: "#1e293b",
        padding: "6px",
        borderRadius: "0.75rem",
      }}
    >
      {cells.map((row, r) =>
        row.map((cell, c) => {
          const text = cellDisplay(cell);
          const isP1 = cell && cell.owner === "Player1";
          const isSelected =
            selectedFrom && selectedFrom.row === r && selectedFrom.col === c;

          const bg = cell
            ? isP1
              ? "#334155"
              : "#1d4ed8"
            : "#020617";

          const borderColor = isSelected ? "#facc15" : "#1f2937";
          const borderWidth = isSelected ? "3px" : "1px";

          return (
            <div
              key={`${r}-${c}`}
              onClick={() => onCellClick && onCellClick(r, c)}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "0.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
                border: `${borderWidth} solid ${borderColor}`,
                background: bg,
                boxShadow: cell
                  ? "0 0 6px rgba(15,23,42,0.6)"
                  : "0 0 2px rgba(15,23,42,0.4)",
                cursor: "pointer",
              }}
            >
              {text}
            </div>
          );
        })
      )}
    </div>
  );
}

export default App;
