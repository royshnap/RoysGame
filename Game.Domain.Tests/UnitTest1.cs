using Game.Domain;
using Game.Domain.Models;
using Xunit;

namespace Game.Domain.Tests
{
    public class GameLogicTests
    {
        [Fact]
        public void MouseBeatsElephant_PredicateIsTrue()
        {
            var result = GameLogic.AttackerBeatsDefender(PieceType.Mouse, PieceType.Elephant);

            Assert.True(result);
        }

        [Fact]
        public void IsAdjacent_OneStepDiagonal_IsTrue()
        {
            var from = new Position(3, 3);
            var to = new Position(4, 4);

            var adjacent = GameLogic.IsAdjacent(from, to);

            Assert.True(adjacent);
        }

        [Fact]
        public void IsAdjacent_TwoStepsAway_IsFalse()
        {
            var from = new Position(0, 0);
            var to = new Position(0, 2);

            var adjacent = GameLogic.IsAdjacent(from, to);

            Assert.False(adjacent);
        }
        [Fact]
        public void ElephantKillsLowLifeTiger_AndMovesIntoTargetSquare()
        {
            var state = new GameState
            {
                Status = GameStatus.InProgress,
                CurrentPlayer = Player.Player1
            };

            // Player1 Elephant at (3,3)
            var elephant = new Piece(Player.Player1, PieceType.Elephant);
            state.Board.SetPiece(3, 3, elephant);

            // Player2 Tiger at (3,4) with only 1 life left
            var tiger = new Piece(Player.Player2, PieceType.Tiger);
            tiger.TakeHit(); // 3 -> 2
            tiger.TakeHit(); // 2 -> 1
            state.Board.SetPiece(3, 4, tiger);

            var from = new Position(3, 3);
            var to = new Position(3, 4);

            var ok = GameLogic.TryMove(state, from, to, out var error);

            Assert.True(ok, error);

            // Tiger should be dead
            Assert.True(tiger.IsDead);

            // From is now empty
            Assert.Null(state.Board.GetPiece(3, 3));

            // Elephant moved into target square
            var pieceAtTo = state.Board.GetPiece(3, 4);
            Assert.NotNull(pieceAtTo);
            Assert.Equal(Player.Player1, pieceAtTo.Owner);
            Assert.Equal(PieceType.Elephant, pieceAtTo.Type);
            Assert.Equal(Piece.MaxLives, pieceAtTo.Lives);

            // Turn should switch to Player2
            Assert.Equal(Player.Player2, state.CurrentPlayer);
        }

        [Fact]
        public void TryMove_Fails_WhenMovingTooFar()
        {
            var state = new GameState
            {
                Status = GameStatus.InProgress,
                CurrentPlayer = Player.Player1
            };

            var mouse = new Piece(Player.Player1, PieceType.Mouse);
            state.Board.SetPiece(0, 0, mouse);

            var from = new Position(0, 0);
            var to = new Position(0, 2);

            var ok = GameLogic.TryMove(state, from, to, out var error);

            Assert.False(ok);
            Assert.Equal("Pieces can move only one step in any direction", error);
        }
        [Fact]
        public void TigerHitsMouse_MouseLosesOneLife_DefenderStaysIfAlive()
        {
            var state = new GameState
            {
                Status = GameStatus.InProgress,
                CurrentPlayer = Player.Player1
            };

            // Player1 Tiger at (1,1)
            var tiger = new Piece(Player.Player1, PieceType.Tiger);
            state.Board.SetPiece(1, 1, tiger);

            // Player2 Mouse at (1,2) full life
            var mouse = new Piece(Player.Player2, PieceType.Mouse);
            state.Board.SetPiece(1, 2, mouse);

            var from = new Position(1, 1);
            var to = new Position(1, 2);

            var ok = GameLogic.TryMove(state, from, to, out var error);

            Assert.True(ok, error);

            // Tiger beats Mouse, so Mouse loses one life
            Assert.Equal(Piece.MaxLives - 1, mouse.Lives);
            Assert.Equal(Piece.MaxLives, tiger.Lives);

            // In our current rules, attacker only moves in if defender dies
            // Mouse is still alive, so Tiger stays at (1,1), Mouse stays at (1,2)
            var pieceAtFrom = state.Board.GetPiece(1, 1);
            var pieceAtTo = state.Board.GetPiece(1, 2);

            Assert.NotNull(pieceAtFrom);
            Assert.NotNull(pieceAtTo);

            Assert.Equal(Player.Player1, pieceAtFrom.Owner);
            Assert.Equal(PieceType.Tiger, pieceAtFrom.Type);

            Assert.Equal(Player.Player2, pieceAtTo.Owner);
            Assert.Equal(PieceType.Mouse, pieceAtTo.Type);

            // Turn should switch to Player2
            Assert.Equal(Player.Player2, state.CurrentPlayer);
        }
        [Fact]
        public void Player1Wins_WhenCarrierBringsEnemyFlagToHomeMiddle()
        {
            var state = new GameState
            {
                Status = GameStatus.InProgress,
                CurrentPlayer = Player.Player1
            };

            // Place Player1 piece that already carries Player2 flag
            // Put it just above Player1FlagHome so one move reaches goal
            var carrier = new Piece(Player.Player1, PieceType.Tiger)
            {
                HasEnemyFlag = true
            };

            var goal = state.Player1FlagHome;        // usually (6,3)
            var start = new Position(goal.Row - 1, goal.Col);  // (5,3)

            state.Board.SetPiece(start.Row, start.Col, carrier);

            // Since carrier holds Player2 flag, that flag is not on the board
            state.IsPlayer2FlagOnBoard = false;

            var from = start;
            var to = goal; // moving into home middle

            var ok = GameLogic.TryMove(state, from, to, out var error);

            Assert.True(ok, error);

            // Game should be finished and Player1 should be winner
            Assert.Equal(GameStatus.Finished, state.Status);
            Assert.Equal(Player.Player1, state.Winner);

            // Carrier should now be on the goal square
            var pieceAtGoal = state.Board.GetPiece(goal.Row, goal.Col);
            Assert.NotNull(pieceAtGoal);
            Assert.Equal(Player.Player1, pieceAtGoal.Owner);
            Assert.Equal(PieceType.Tiger, pieceAtGoal.Type);
        }

        [Fact]
        public void TryPlacePiece_Fails_WhenNotOnFirstTwoRows()
        {
            var state = new GameState
            {
                Status = GameStatus.Placement,
                CurrentPlayer = Player.Player1
            };

            // row 3 is NOT in Player1 first two rows (which are rows 5 and 6)
            var pos = new Position(3, 3);

            var ok = GameLogic.TryPlacePiece(state, pos, PieceType.Elephant, out var error);

            Assert.False(ok);
            Assert.Equal("You can place pieces only on your first two rows", error);

            // Board must still be empty at that position
            Assert.Null(state.Board.GetPiece(pos.Row, pos.Col));
        }

        [Fact]
        public void TryPlacePiece_Fails_WhenSquareIsOccupied()
        {
            var state = new GameState
            {
                Status = GameStatus.Placement,
                CurrentPlayer = Player.Player1
            };

            var pos = new Position(Board.Size - 1, 0); // row 6, col 0 valid for Player1

            // First placement should succeed
            var ok1 = GameLogic.TryPlacePiece(state, pos, PieceType.Elephant, out var error1);
            Assert.True(ok1, error1);
            Assert.NotNull(state.Board.GetPiece(pos.Row, pos.Col));

            // Now try to place another piece on the same square for Player1
            state.CurrentPlayer = Player.Player1; // switch back manually for the test
            var ok2 = GameLogic.TryPlacePiece(state, pos, PieceType.Tiger, out var error2);

            Assert.False(ok2);
            Assert.Equal("There is already a piece on that square", error2);

            // The original piece should still be there
            var piece = state.Board.GetPiece(pos.Row, pos.Col);
            Assert.NotNull(piece);
            Assert.Equal(PieceType.Elephant, piece.Type);
            Assert.Equal(Player.Player1, piece.Owner);
        }

        [Fact]
        public void TryPlacePiece_Fails_WhenPlacingMoreThanFourOfSameType()
        {
            var state = new GameState
            {
                Status = GameStatus.Placement,
                CurrentPlayer = Player.Player1
            };

            // Place 4 Elephants for Player1, all should succeed
            for (int i = 0; i < 4; i++)
            {
                state.CurrentPlayer = Player.Player1;
                var pos = new Position(Board.Size - 1, i); // row 6, cols 0..3
                var ok = GameLogic.TryPlacePiece(state, pos, PieceType.Elephant, out var error);
                Assert.True(ok, error);
            }

            // 5th Elephant should fail
            state.CurrentPlayer = Player.Player1;
            var fifthPos = new Position(Board.Size - 1, 4); // still valid row

            var ok5 = GameLogic.TryPlacePiece(state, fifthPos, PieceType.Elephant, out var error5);

            Assert.False(ok5);
            Assert.Equal("You have already placed all pieces of this type", error5);

            // Ensure no piece was placed on the fifth position
            Assert.Null(state.Board.GetPiece(fifthPos.Row, fifthPos.Col));
        }
        [Fact]
        public void GameStatusBecomesInProgress_WhenBothPlayersFinishedPlacement()
        {
            var state = new GameState
            {
                Status = GameStatus.Placement,
                CurrentPlayer = Player.Player1
            };

            // Pretend Player2 has already placed all pieces
            state.Player2ElephantsPlaced = 4;
            state.Player2TigersPlaced = 4;
            state.Player2MicePlaced = 4;
            state.Player2ScorpionsPlaced = 2;

            // Prepare 12 valid positions for Player1 on their first two rows (rows 5 and 6)
            var spots = new System.Collections.Generic.List<Position>();

            for (int r = Board.Size - 1; r >= Board.Size - 2; r--) // rows 6 and 5
            {
                for (int c = 0; c < Board.Size; c++)              // cols 0..6
                {
                    spots.Add(new Position(r, c));
                }
            }

            // spots now has 14 positions, we will use the first 12
            int spotIndex = 0;

            void PlaceForPlayer1(PieceType type)
            {
                state.CurrentPlayer = Player.Player1;
                var pos = spots[spotIndex++];
                var ok = GameLogic.TryPlacePiece(state, pos, type, out var error);
                Assert.True(ok, error);
            }
             // 2 Scorpions
            for (int i = 0; i < 2; i++)
            {
                PlaceForPlayer1(PieceType.Scorpion);
            }
            // 4 Elephants
            for (int i = 0; i < 4; i++)
            {
                PlaceForPlayer1(PieceType.Elephant);
            }

            // 4 Tigers
            for (int i = 0; i < 4; i++)
            {
                PlaceForPlayer1(PieceType.Tiger);
            }

            // 4 Mice
            for (int i = 0; i < 4; i++)
            {
                PlaceForPlayer1(PieceType.Mouse);
            }

            // After last placement, both players should be "placement done"
            Assert.True(state.Player1PlacementDone);
            Assert.True(state.Player2PlacementDone);

            // And the game should transition to InProgress with Player1 to move
            Assert.Equal(GameStatus.InProgress, state.Status);
            Assert.Equal(Player.Player1, state.CurrentPlayer);
        }

    }
}
