using System;

namespace Game.Domain.Models
{
    public enum Player
    {
        None = 0,
        Player1 = 1,
        Player2 = 2
    }

    public enum PieceType
    {
        None = 0,
        Elephant = 1,
        Tiger = 2,
        Mouse = 3,
        Scorpion = 4
    }

    public enum GameStatus
    {
        Placement,
        InProgress,
        Finished
    }

    public readonly struct Position
    {
        public int Row { get; }
        public int Col { get; }

        public Position(int row, int col)
        {
            Row = row;
            Col = col;
        }
    }

    public sealed class Piece
    {
        public Player Owner { get; }
        public PieceType Type { get; }
        public int Lives { get; private set; }
        public bool HasEnemyFlag { get; set; }

        public const int MaxLives = 3;

        public Piece(Player owner, PieceType type)
        {
            Owner = owner;
            Type = type;
            Lives = MaxLives;
        }

        public void TakeHit(int damage = 1)
        {
            Lives = Math.Max(0, Lives - damage);
        }

        public bool IsDead => Lives <= 0;
    }

    public class Board
    {
        public const int Size = 7;

        private readonly Piece[,] _cells = new Piece[Size, Size];

        public bool IsInside(int row, int col) =>
            row >= 0 && row < Size && col >= 0 && col < Size;

        public Piece GetPiece(int row, int col) => _cells[row, col];

        public void SetPiece(int row, int col, Piece piece) => _cells[row, col] = piece;
    }

    public class GameState
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Board Board { get; set; } = new Board();

        public Player CurrentPlayer { get; set; } = Player.Player1;

        public GameStatus Status { get; set; } = GameStatus.Placement;

        public Player? Winner { get; set; }

        // placement counters
        public int Player1ElephantsPlaced { get; set; }
        public int Player1TigersPlaced { get; set; }
        public int Player1MicePlaced { get; set; }
        public int Player1ScorpionsPlaced { get; set; }

        public int Player2ElephantsPlaced { get; set; }
        public int Player2TigersPlaced { get; set; }
        public int Player2MicePlaced { get; set; }
        public int Player2ScorpionsPlaced { get; set; }
        public string Player1Name { get; set; } = string.Empty;
        public string Player2Name { get; set; } = string.Empty;
        public bool Player1PlacementDone =>
            Player1ElephantsPlaced >= 4 &&
            Player1TigersPlaced >= 4 &&
            Player1ScorpionsPlaced >= 2 &&
            Player1MicePlaced >= 4;

        public bool Player2PlacementDone =>
            Player2ElephantsPlaced >= 4 &&
            Player2TigersPlaced >= 4 &&
            Player2ScorpionsPlaced >= 2 &&
            Player2MicePlaced >= 4;

        // home positions of each players own flag
        public Position Player1FlagHome { get; } = new Position(Board.Size - 1, Board.Size / 2);
        public Position Player2FlagHome { get; } = new Position(0, Board.Size / 2);

        // current positions of flags when they are on the board
        public Position Player1FlagPos { get; set; }
        public Position Player2FlagPos { get; set; }

        // whether the flag is currently on a board tile (not being carried)
        public bool IsPlayer1FlagOnBoard { get; set; } = true;
        public bool IsPlayer2FlagOnBoard { get; set; } = true;

        public GameState()
        {
            Player1FlagPos = Player1FlagHome;
            Player2FlagPos = Player2FlagHome;
        }
    }

}
