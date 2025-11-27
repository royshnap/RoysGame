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
        Mouse = 3
    }

    public enum GameStatus
    {
        Placement,   // players are placing their 12 pieces each
        InProgress,  // game running
        Finished     // someone won
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

        // fixed flag positions
        public Position Player1Flag { get; } = new Position(Board.Size - 1, Board.Size / 2);
        public Position Player2Flag { get; } = new Position(0, Board.Size / 2);
    }
}