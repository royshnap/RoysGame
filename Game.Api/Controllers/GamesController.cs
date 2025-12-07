using System;
using System.Linq;
using Game.Api.Services;
using Game.Domain;
using Game.Domain.Models;
using Microsoft.AspNetCore.Mvc;

namespace Game.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class GamesController : ControllerBase
    {
        private readonly IGameStore _store;

        public GamesController(IGameStore store)
        {
            _store = store;
        }

        // POST api/games
        // create a new game and return its id and initial state
        [HttpPost]
        public ActionResult<GameStateDto> CreateGame()
        {
            var state = _store.CreateGame();
            return Ok(GameStateDto.FromDomain(state));
        }

        // GET api/games/{id}
        // get current state of a game
        [HttpGet("{id:guid}")]
        public ActionResult<GameStateDto> GetGame(Guid id)
        {
            if (!_store.TryGet(id, out var state))
            {
                return NotFound();
            }

            return Ok(GameStateDto.FromDomain(state));
        }

        // POST api/games/{id}/place
        // body: { "row": 6, "col": 0, "pieceType": "Elephant" }
        [HttpPost("{id:guid}/place")]
        public ActionResult<GameStateDto> PlacePiece(Guid id, [FromBody] PlacePieceRequest request)
        {
            if (!_store.TryGet(id, out var state))
            {
                return NotFound();
            }

            if (!Enum.TryParse<PieceType>(request.PieceType, ignoreCase: true, out var pieceType))
            {
                return BadRequest("Invalid piece type");
            }

            var pos = new Position(request.Row, request.Col);

            var ok = GameLogic.TryPlacePiece(state, pos, pieceType, out var error);
            if (!ok)
            {
                return BadRequest(error);
            }

            return Ok(GameStateDto.FromDomain(state));
        }

        // POST api/games/{id}/move
        // body: { "fromRow": 3, "fromCol": 3, "toRow": 3, "toCol": 4 }
        [HttpPost("{id:guid}/move")]
        public ActionResult<GameStateDto> Move(Guid id, [FromBody] MoveRequest request)
        {
            if (!_store.TryGet(id, out var state))
            {
                return NotFound();
            }

            var from = new Position(request.FromRow, request.FromCol);
            var to = new Position(request.ToRow, request.ToCol);

            var ok = GameLogic.TryMove(state, from, to, out var error);
            if (!ok)
            {
                return BadRequest(error);
            }

            return Ok(GameStateDto.FromDomain(state));
        }
        // POST api/games/{id}/register
        // body, { "side": "Player1", "name": "Roy" }
        [HttpPost("{id:guid}/register")]
        public ActionResult<GameStateDto> Register(Guid id, [FromBody] RegisterPlayerRequest request)
        {
            if (!_store.TryGet(id, out var state))
            {
                return NotFound();
            }

            if (!Enum.TryParse<Player>(request.Side, ignoreCase: true, out var side) ||
                side == Player.None)
            {
                return BadRequest("Invalid side");
            }

            var trimmedName = request.Name?.Trim() ?? "";

            if (side == Player.Player1)
            {
                state.Player1Name = trimmedName;
            }
            else if (side == Player.Player2)
            {
                state.Player2Name = trimmedName;
            }

            return Ok(GameStateDto.FromDomain(state));
        }

    }

    // request DTOs

    public class PlacePieceRequest
    {
        public int Row { get; set; }
        public int Col { get; set; }
        public string PieceType { get; set; } = string.Empty; // "Elephant", "Tiger", "Mouse"
    }

    public class MoveRequest
    {
        public int FromRow { get; set; }
        public int FromCol { get; set; }
        public int ToRow { get; set; }
        public int ToCol { get; set; }
    }
    public class RegisterPlayerRequest
    {
        public string Side { get; set; } = ""; // "Player1" or "Player2"
        public string Name { get; set; } = "";
    }

    // response DTO

    public class GameStateDto
    {
        public Guid Id { get; set; }
        public string CurrentPlayer { get; set; } = "";
        public string Status { get; set; } = "";
        public string Winner { get; set; } = "";
        public CellDto[][] Cells { get; set; } = Array.Empty<CellDto[]>();
        public FlagDto Player1Flag { get; set; }
        public FlagDto Player2Flag { get; set; }
        public string Player1Name { get; set; } = "";
        public string Player2Name { get; set; } = "";

        public static GameStateDto FromDomain(GameState state)
        {
            var size = Game.Domain.Models.Board.Size;
            var cells = new CellDto[size][];

            for (int r = 0; r < size; r++)
            {
                cells[r] = new CellDto[size];
                for (int c = 0; c < size; c++)
                {
                    var piece = state.Board.GetPiece(r, c);
                    if (piece == null)
                    {
                        cells[r][c] = null;
                    }
                    else
                    {
                        cells[r][c] = new CellDto
                        {
                            Owner = piece.Owner.ToString(),
                            Type = piece.Type.ToString(),
                            Lives = piece.Lives,
                            HasEnemyFlag = piece.HasEnemyFlag
                        };
                    }
                }
            }

            return new GameStateDto
            {
                Id = state.Id,
                CurrentPlayer = state.CurrentPlayer.ToString(),
                Status = state.Status.ToString(),
                Winner = state.Winner?.ToString() ?? "",
                Cells = cells,
                Player1Flag = new FlagDto
                {
                    Row = state.Player1FlagPos.Row,
                    Col = state.Player1FlagPos.Col,
                    OnBoard = state.IsPlayer1FlagOnBoard
                },
                Player2Flag = new FlagDto
                {
                    Row = state.Player2FlagPos.Row,
                    Col = state.Player2FlagPos.Col,
                    OnBoard = state.IsPlayer2FlagOnBoard
                },
                Player1Name = state.Player1Name,
                Player2Name = state.Player2Name
            };
        }
    }

    public class CellDto
    {
        public string Owner { get; set; } = "";
        public string Type { get; set; } = "";
        public int Lives { get; set; }
        public bool HasEnemyFlag { get; set; }
    }

    public class FlagDto
    {
        public int Row { get; set; }
        public int Col { get; set; }
        public bool OnBoard { get; set; }
    }
}

