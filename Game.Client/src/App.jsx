import { useState, useEffect, useRef } from "react";
import * as signalR from "@microsoft/signalr";
import { createGame, placePiece, movePiece, getGame, registerPlayer } from "./api";

import PurpleElephant from "./assets/purpleElephant.png";
import YellowElephant from "./assets/yellowElephant.png";
import PurpleMouse from "./assets/purpleMouse.png";
import YellowMouse from "./assets/yellowMouse.png";
import PurpleTiger from "./assets/purpleTiger.png";
import YellowTiger from "./assets/yellowTiger.png";
import PurpleScorpion from "./assets/purpleScorpion.png";
import YellowScorpion from "./assets/yellowScorpion.png";
import FightVideoFile from "./assets/purpleElephantYellowTigerFight.mp4"; 

const COLOR_PURPLE = "#a855f7";
const COLOR_YELLOW = "#facc15";

const INITIAL_PIECES = {
  Elephant: 4,
  Tiger: 4,
  Mouse: 4,
  Scorpion: 2,
};

const PIECE_IMAGES = {
  Player1: {
    Elephant: PurpleElephant,
    Mouse: PurpleMouse,
    Tiger: PurpleTiger,
    Scorpion: PurpleScorpion
  },
  Player2: {
    Elephant: YellowElephant,
    Mouse: YellowMouse,
    Tiger: YellowTiger,
    Scorpion: YellowScorpion
  },
};

const VIDEO_MAP = {
  PurpleElephantVsYellowTiger: FightVideoFile,
};

function computeRemainingPieces(game, mySide) {
  const remaining = { ...INITIAL_PIECES };
  if (!game || !game.cells || !mySide) return remaining;

  for (let r = 0; r < game.cells.length; r++) {
    for (let c = 0; c < game.cells[r].length; c++) {
      const cell = game.cells[r][c];
      if (!cell) continue;
      if (cell.owner === mySide && remaining[cell.type] != null) {
        remaining[cell.type] = Math.max(0, remaining[cell.type] - 1);
      }
    }
  }
  return remaining;
}

function getSideColors(gameId) {
  return {
    Player1: COLOR_PURPLE, // bottom
    Player2: COLOR_YELLOW, // top
  };
}

function getAssignedSide(gameId, role) {
  if (!gameId) return null;
  const hex = gameId.replace(/-/g, "");
  const first = parseInt(hex[0], 16);
  const hostIsPlayer1 = first % 2 === 0;

  if (role === "host") return hostIsPlayer1 ? "Player1" : "Player2";
  if (role === "guest") return hostIsPlayer1 ? "Player2" : "Player1";
  return null;
}

function sideLabel(side, sideColors) {
  if (!side) return "";
  if (side === "Player1") return "Purple player";
  if (side === "Player2") return "Yellow player";
  return side;
}

function cellDisplay(cell, mySide) {
  if (!cell) return "·";
  const owner = cell.owner;
  const r1 = cell.revealedToPlayer1;
  const r2 = cell.revealedToPlayer2;

  if (
    mySide &&
    owner &&
    owner !== mySide &&
    ((mySide === "Player1" && !r1) ||
      (mySide === "Player2" && !r2))
  ) {
    return "";
  }
  if (!cell.type) return "";
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

  const [mySide, setMySide] = useState(null);
  const [myName, setMyName] = useState("");
  const connectionRef = useRef(null);

  // --- Video State ---
  const [currentVideo, setCurrentVideo] = useState(null);

  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl("http://localhost:5000/gamehub")
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    connectionRef.current = connection;

    connection.on("GameUpdated", (dto) => {
      console.log("GameUpdated from hub", dto);
      setGame(dto);
    });

    connection
      .start()
      .then(() => {
        console.log("SignalR connected");
      })
      .catch((err) => {
        console.error("SignalR connection error", err);
      });

    return () => {
      connection.stop();
    };
  }, []);

  useEffect(() => {
    if (!game || !game.id) return;

    const connection = connectionRef.current;
    if (!connection) return;

    if (connection.state !== signalR.HubConnectionState.Connected) {
      return;
    }

    connection
      .invoke("JoinGame", game.id.toString())
      .then(() => {
        console.log("Joined hub group", game.id);
      })
      .catch((err) => {
        console.error("JoinGame failed", err);
      });
  }, [game?.id]);

  useEffect(() => {
    if (!game || !game.id) return;
    if (game.winner) return;

    const gameId = game.id;

    const interval = setInterval(async () => {
      try {
        const fresh = await getGame(gameId);
        setGame(fresh);
      } catch (err) {
        console.error("Polling getGame failed, ", err);
      }
    }, 1000);

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
          setGame(updated); 
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

    // --- Placement Phase ---
    if (game.status === "Placement") {
      const size = game.cells.length;

      if (mySide === "Player1") {
        if (row < size - 2) {
          setError("You can place pieces only on your two bottom rows");
          return;
        }
      } else if (mySide === "Player2") {
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

    // --- In Progress Phase ---
    if (game.status === "InProgress") {
      if (mySide && mySide !== game.currentPlayer) {
        setError("It is not your turn");
        return;
      }

      const cell = game.cells[row]?.[col];

      // 1. If nothing selected yet, select a piece
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

      // 2. If clicking the same piece, deselect
      if (selectedFrom.row === row && selectedFrom.col === col) {
        setSelectedFrom(null);
        setError("");
        return;
      }

      // 3. If clicking another own piece, switch selection
      if (cell && cell.owner === game.currentPlayer) {
        setSelectedFrom({ row, col });
        setError("");
        return;
      }

      // 4. ATTEMPTING MOVE (Empty cell or Enemy cell)
      
      // --- VIDEO DETECTION LOGIC STARTS HERE ---
      // We check what piece is attacking (selectedFrom) and what is defending (cell at row,col)
      const attacker = game.cells[selectedFrom.row][selectedFrom.col];
      const defender = game.cells[row][col];

      if (attacker && defender && attacker.owner !== defender.owner) {
          // It is an attack!
          
          // Case A: Purple Elephant (Attacker) vs Yellow Tiger (Defender)
          if (
              attacker.owner === "Player1" && attacker.type === "Elephant" &&
              defender.owner === "Player2" && defender.type === "Tiger"
          ) {
               // Check if the Defender (Tiger) is currently HIDDEN to Player 1
               // Note: Player 1 is Purple.
               if (!defender.revealedToPlayer1) {
                   setCurrentVideo(VIDEO_MAP.PurpleElephantVsYellowTiger);
               }
          }

          // Case B: Yellow Tiger (Attacker) vs Purple Elephant (Defender)
          if (
            attacker.owner === "Player2" && attacker.type === "Tiger" &&
            defender.owner === "Player1" && defender.type === "Elephant"
          ) {
             // Check if the Attacker (Tiger) is currently HIDDEN to Player 1
             if (!attacker.revealedToPlayer1) {
                 setCurrentVideo(VIDEO_MAP.PurpleElephantVsYellowTiger);
             }
          }
      }
      // --- VIDEO DETECTION LOGIC ENDS ---

      // Execute the move
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
        background: "#057137ff",
        color: "white",
        position: "relative"
      }}
    >
        {/* --- Video Overlay --- */}
        {currentVideo && (
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0,0,0,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999
            }}>
                <video 
                    width="800" 
                    autoPlay 
                    controls
                    onEnded={() => setCurrentVideo(null)}
                >
                    <source src={currentVideo} type="video/mp4" />
                    Your browser does not support the video tag.
                </video>
                <button 
                    onClick={() => setCurrentVideo(null)}
                    style={{
                        position: 'absolute',
                        top: 20,
                        right: 20,
                        padding: '10px 20px',
                        fontSize: '16px',
                        cursor: 'pointer'
                    }}
                >
                    Close
                </button>
            </div>
        )}

      <h1>Jungle Catch</h1>

      <div
        style={{
          marginTop: "1rem",
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "center",
          gap: "2rem",
          width: "100%",
          maxWidth: "1100px",
        }}
      >
        <div style={{ flexShrink: 0 }}>
          {game && (
            <BoardView
              cells={game.cells}
              onCellClick={handleCellClick}
              selectedFrom={selectedFrom}
              player1Flag={game.player1Flag}
              player2Flag={game.player2Flag}
              sideColors={getSideColors(game.id)}
              mySide={mySide}
            />
          )}
        </div>

        <div
          style={{
            minWidth: "320px",
            maxWidth: "380px",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "0.75rem",
          }}
        >
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

          <div>
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

          <div>
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
            <div>
              <span>You are </span>
              {(() => {
                const sideColors = getSideColors(game.id);
                const color =
                  mySide === "Player1"
                    ? sideColors.Player1
                    : sideColors.Player2;
                const label =
                  myName.trim() || sideLabel(mySide, sideColors);

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
            <div>
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
            <div>
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
              }}
            >
              {error}
            </div>
          )}

          {game && (
            <>
              <div>
                <strong>Game id: </strong> {game.id}
              </div>

              <div>
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
                    (game.player1Name || "").trim() ||
                    sideLabel("Player1", sideColors);
                  const p2Name =
                    (game.player2Name || "").trim() ||
                    sideLabel("Player2", sideColors);

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

              <div>
                <strong>Status: </strong> {game.status}
              </div>

              {(() => {
                const sideColors = getSideColors(game.id);
                const p1Color = sideColors.Player1;
                const p2Color = sideColors.Player2;
                const p1Name =
                  (game.player1Name || "").trim() ||
                  sideLabel("Player1", sideColors);
                const p2Name =
                  (game.player2Name || "").trim() ||
                  sideLabel("Player2", sideColors);

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
                      <span
                        style={{ color: p1Color, fontWeight: "bold" }}
                      >
                        {p1Name}
                      </span>
                      <span style={{ marginLeft: "0.25rem" }}>
                        bottom (purple side)
                      </span>
                    </div>
                    <div>
                      <span
                        style={{ color: p2Color, fontWeight: "bold" }}
                      >
                        {p2Name}
                      </span>
                      <span style={{ marginLeft: "0.25rem" }}>
                        top (yellow side)
                      </span>
                    </div>
                  </div>
                );
              })()}

              {game.winner &&
                (() => {
                  const sideColors = getSideColors(game.id);
                  const winnerColor =
                    game.winner === "Player1"
                      ? sideColors.Player1
                      : sideColors.Player2;

                  const winnerName =
                    game.winner === "Player1"
                      ? game.player1Name?.trim() || "Player 1"
                      : game.player2Name?.trim() || "Player 2";

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

              {game.status === "Placement" && mySide && (
                <PieceCounter remaining={computeRemainingPieces(game, mySide)} />
              )}
            </>
          )}
        </div>
      </div>
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
        color: "#ef4444",
      }}
    >
      {hearts}
    </div>
  );
}

function PieceCounter({ remaining }) {
  const order = ["Elephant", "Tiger", "Mouse", "Scorpion"];

  return (
    <div
      style={{
        minWidth: 140,
        padding: "0.75rem 0.75rem",
        background: "#020617",
        borderRadius: "0.75rem",
        border: "1px solid #1f2937",
        color: "white",
        fontSize: "0.85rem",
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>
        Your pieces
      </div>
      {order.map((type) => (
        <div
          key={type}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.25rem",
            opacity: remaining[type] === 0 ? 0.4 : 1,
          }}
        >
          <span>{type}</span>
          <span>{remaining[type]}</span>
        </div>
      ))}
    </div>
  );
}

function BoardView({
  cells,
  onCellClick,
  selectedFrom,
  player1Flag,
  player2Flag,
  sideColors,
  mySide,
}) {
  if (!cells) return null;

  const size = cells.length;
  const cellSize = 80; 
  const gap = 4;
  const padding = 6;

  const boardWidth = padding * 2 + size * cellSize + (size - 1) * gap;
  const boardHeight = padding * 2 + size * cellSize + (size - 1) * gap;

  const player1Color = sideColors?.Player1 ?? COLOR_PURPLE;
  const player2Color = sideColors?.Player2 ?? COLOR_YELLOW;

  const player1Home = { row: size - 1, col: Math.floor(size / 2) }; 
  const player2Home = { row: 0, col: Math.floor(size / 2) }; 

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
            const text = cellDisplay(cell, mySide);
            const isP1 = cell && cell.owner === "Player1";
            const isSelected =
              selectedFrom && selectedFrom.row === r && selectedFrom.col === c;

            const bg = cell
              ? isP1
                ? "#4c1d95" 
                : "#d9df13ff" 
              : "#020617";

            const borderColor = isSelected ? "#ffffff" : "#1f2937";
            const borderWidth = isSelected ? "3px" : "1px";

            let carriedFlagColor = null;
            if (cell && cell.hasEnemyFlag) {
              carriedFlagColor =
                cell.owner === "Player1" ? player2Color : player1Color;
            }

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
                  fontSize: "1.4rem",
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
                  {(() => {
                    const isRevealed = text !== "";
                    if (!isRevealed) return <span>{text}</span>;

                    const img =
                      PIECE_IMAGES[cell.owner]?.[cell.type];

                    if (img) {
                      return (
                        <img
                          src={img}
                          alt={`${cell.owner} ${cell.type}`}
                          style={{
                            width: "70%",
                            height: "70%",
                            objectFit: "contain",
                          }}
                        />
                      );
                    }

                    return <span>{text}</span>;
                  })()}

                    <Hearts lives={cell.lives} />
                  </div>
                ) : (
                  <span>{text}</span>
                )}

                {carriedFlagColor && (
                  <span
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      fontSize: "1rem",
                      color: carriedFlagColor,
                      textShadow: "0 0 2px black",
                    }}
                  >
                    ⚑
                  </span>
                )}

                {groundFlagColor && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: 4,
                      right: 4,
                      fontSize: "1rem",
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