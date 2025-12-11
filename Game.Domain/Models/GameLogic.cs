
using System;
using Game.Domain.Models;

namespace Game.Domain
{
    public static class GameLogic
    {
        public static bool IsAdjacent(Position from, Position to)
        {
            var dr = Math.Abs(from.Row - to.Row);
            var dc = Math.Abs(from.Col - to.Col);
            if (dr == 0 && dc == 0) return false;
            return dr <= 1 && dc <= 1;
        }

        public static bool AttackerBeatsDefender(PieceType attacker, PieceType defender)
        {
            return
                (attacker == PieceType.Elephant && defender == PieceType.Tiger) ||
                (attacker == PieceType.Tiger && defender == PieceType.Mouse) ||
                (attacker == PieceType.Mouse && defender == PieceType.Elephant);
        }

        private static bool IsPlacementRow(Player player, int row)
        {
            // rows 0 and 1 are Player2 side
            // rows 5 and 6 are Player1 side

            return player switch
            {
                Player.Player1 => row >= Board.Size - 2, // 5 or 6
                Player.Player2 => row <= 1,              // 0 or 1
                _ => false
            };
        }

        private static bool HasReachedTypeLimit(GameState state, Player player, PieceType type)
        {
            return player switch
            {
                Player.Player1 => type switch
                {
                    PieceType.Elephant => state.Player1ElephantsPlaced >= 4,
                    PieceType.Tiger => state.Player1TigersPlaced >= 4,
                    PieceType.Mouse => state.Player1MicePlaced >= 4,
                    PieceType.Scorpion => state.Player1ScorpionsPlaced >= 2,
                    _ => true
                },
                Player.Player2 => type switch
                {
                    PieceType.Elephant => state.Player2ElephantsPlaced >= 4,
                    PieceType.Tiger => state.Player2TigersPlaced >= 4,
                    PieceType.Mouse => state.Player2MicePlaced >= 4,
                    PieceType.Scorpion => state.Player2ScorpionsPlaced >= 2,
                    _ => true
                },
                _ => true
            };
        }

        private static void IncrementTypeCounter(GameState state, Player player, PieceType type)
        {
            if (player == Player.Player1)
            {
                switch (type)
                {
                    case PieceType.Elephant:
                        state.Player1ElephantsPlaced++;
                        break;
                    case PieceType.Tiger:
                        state.Player1TigersPlaced++;
                        break;
                    case PieceType.Mouse:
                        state.Player1MicePlaced++;
                        break;
                    case PieceType.Scorpion:
                        state.Player1ScorpionsPlaced++;
                        break;
                }
            }
            else if (player == Player.Player2)
            {
                switch (type)
                {
                    case PieceType.Elephant:
                        state.Player2ElephantsPlaced++;
                        break;
                    case PieceType.Tiger:
                        state.Player2TigersPlaced++;
                        break;
                    case PieceType.Mouse:
                        state.Player2MicePlaced++;
                        break;
                    case PieceType.Scorpion:
                        state.Player2ScorpionsPlaced++;
                        break;
                }
            }
        }
        public static bool TryPlacePiece(GameState state, Position pos, PieceType type, out string error)
        {
            error = string.Empty;

            if (state.Status != GameStatus.Placement)
            {
                error = "Game is not in placement phase";
                return false;
            }

            if (type == PieceType.None)
            {
                error = "Invalid piece type";
                return false;
            }

            if (!state.Board.IsInside(pos.Row, pos.Col))
            {
                error = "Position is outside the board";
                return false;
            }

            // decide which player is placing based on the row, independent of CurrentPlayer
            Player player;
            if (pos.Row <= 1)
            {
                // top two rows are always Player2 side (yellow)
                player = Player.Player2;
            }
            else if (pos.Row >= Board.Size - 2)
            {
                // bottom two rows are always Player1 side (purple)
                player = Player.Player1;
            }
            else
            {
                error = "You can place pieces only on your first two rows";
                return false;
            }

            // extra safety check, uses the existing helper
            if (!IsPlacementRow(player, pos.Row))
            {
                error = "You can place pieces only on your first two rows";
                return false;
            }

            if (state.Board.GetPiece(pos.Row, pos.Col) != null)
            {
                error = "There is already a piece on that square";
                return false;
            }

            if (HasReachedTypeLimit(state, player, type))
            {
                error = "You have already placed all pieces of this type";
                return false;
            }

            // place the piece
            var newPiece = new Piece(player, type);
            state.Board.SetPiece(pos.Row, pos.Col, newPiece);
            IncrementTypeCounter(state, player, type);

            // when both players have finished placement, start the game and then turns begin
            if (state.Player1PlacementDone && state.Player2PlacementDone)
            {
                state.Status = GameStatus.InProgress;
                state.CurrentPlayer = Player.Player1; // or Player.Player2 if you want yellow to start
            }

            // no turn switching during placement
            return true;
        }


        /*public static bool IsOnOwnSide(Player player, Position pos)
        {
            if (player == Player.Player1)
            {
                return pos.Row >= Board.Size - 2;
            }

            if (player == Player.Player2)
            {
                return pos.Row <= 1;
            }

            return false;
        }
    */
        public static bool TryMove(GameState state, Position from, Position to, out string error)
        {
            error = string.Empty;

            if (state.Status != GameStatus.InProgress)
            {
                error = "Game is not in progress";
                return false;
            }

            if (!state.Board.IsInside(from.Row, from.Col) || !state.Board.IsInside(to.Row, to.Col))
            {
                error = "Move is outside the board";
                return false;
            }

            if (!IsAdjacent(from, to))
            {
                error = "Pieces can move only one step in any direction";
                return false;
            }

            var movingPiece = state.Board.GetPiece(from.Row, from.Col);
            if (movingPiece == null)
            {
                error = "No piece at source square";
                return false;
            }

            if (movingPiece.Owner != state.CurrentPlayer)
            {
                error = "You can move only your own pieces";
                return false;
            }

            var targetPiece = state.Board.GetPiece(to.Row, to.Col);

            // 1. resolve movement and combat, decide what ends up at "to"
            Piece finalPieceAtTo = null;

            if (targetPiece == null)
            {
                // simple move
                finalPieceAtTo = movingPiece;
                state.Board.SetPiece(from.Row, from.Col, null);
            }
            else
            {
                if (targetPiece.Owner == movingPiece.Owner)
                {
                    error = "You cannot capture your own piece";
                    return false;
                }
                // both pieces become known to both players when they fight
                movingPiece.RevealedToPlayer1 = true;
                movingPiece.RevealedToPlayer2 = true;
                targetPiece.RevealedToPlayer1 = true;
                targetPiece.RevealedToPlayer2 = true;

                // special rule, if any side is Scorpion, both die regardless of lives
                if (movingPiece.Type == PieceType.Scorpion || targetPiece.Type == PieceType.Scorpion)
                {
                    // kill attacker
                    while (!movingPiece.IsDead)
                    {
                        movingPiece.TakeHit();
                    }

                    // kill defender
                    while (!targetPiece.IsDead)
                    {
                        targetPiece.TakeHit();
                    }

                    // remove both from the board
                    state.Board.SetPiece(from.Row, from.Col, null);
                    state.Board.SetPiece(to.Row, to.Col, null);

                    finalPieceAtTo = null;
                }
                else
                {
                    bool attackerWins = AttackerBeatsDefender(movingPiece.Type, targetPiece.Type);
                    bool defenderWins = AttackerBeatsDefender(targetPiece.Type, movingPiece.Type);

                    if (!attackerWins && !defenderWins)
                    {
                        // same type, or neither has advantage, both lose 1 life
                        movingPiece.TakeHit();
                        targetPiece.TakeHit();

                        // handle deaths
                        if (movingPiece.IsDead)
                        {
                            state.Board.SetPiece(from.Row, from.Col, null);
                        }

                        if (targetPiece.IsDead)
                        {
                            state.Board.SetPiece(to.Row, to.Col, null);
                        }

                        if (!movingPiece.IsDead && targetPiece.IsDead)
                        {
                            // attacker moves into now empty cell
                            finalPieceAtTo = movingPiece;
                            state.Board.SetPiece(from.Row, from.Col, null);
                        }
                        else if (!targetPiece.IsDead)
                        {
                            // defender stays, attacker either died or bounced back with equal lives
                            finalPieceAtTo = targetPiece;
                            // attacker already removed if dead
                            if (!movingPiece.IsDead)
                            {
                                // if you prefer attacker to stay in place on tie and both alive, comment this out
                                state.Board.SetPiece(from.Row, from.Col, movingPiece);
                            }
                        }
                    }
                    else if (attackerWins)
                    {
                        // attacker hits defender
                        targetPiece.TakeHit();
                        if (targetPiece.IsDead)
                        {
                            // defender dies, attacker moves into cell
                            state.Board.SetPiece(to.Row, to.Col, null);
                            state.Board.SetPiece(from.Row, from.Col, null);
                            finalPieceAtTo = movingPiece;
                        }
                        else
                        {
                            // defender survives with fewer lives, attacker stays in place
                            finalPieceAtTo = targetPiece;
                            // attacker remains at from
                        }
                    }
                    else if (defenderWins)
                    {
                        // defender hits attacker
                        movingPiece.TakeHit();
                        if (movingPiece.IsDead)
                        {
                            // attacker dies, defender stays
                            state.Board.SetPiece(from.Row, from.Col, null);
                            finalPieceAtTo = targetPiece;
                        }
                        else
                        {
                            // attacker survives with fewer lives, no one moves
                            finalPieceAtTo = targetPiece;
                        }
                    }
                }
            }


            // update board cell if we have a moving piece that ended at "to"
            if (finalPieceAtTo == movingPiece && state.Board.GetPiece(to.Row, to.Col) != movingPiece)
            {
                state.Board.SetPiece(to.Row, to.Col, movingPiece);
            }

            // 2. handle flags for the piece that ended on "to"
            if (finalPieceAtTo != null)
            {
                // check if it steps on enemy flag on the board
                if (finalPieceAtTo.Owner == Player.Player1)
                {
                    // can capture Player2 flag
                    if (state.IsPlayer2FlagOnBoard &&
                        state.Player2FlagPos.Row == to.Row &&
                        state.Player2FlagPos.Col == to.Col)
                    {
                        finalPieceAtTo.HasEnemyFlag = true;
                        state.IsPlayer2FlagOnBoard = false;
                    }
                }
                else if (finalPieceAtTo.Owner == Player.Player2)
                {
                    // can capture Player1 flag
                    if (state.IsPlayer1FlagOnBoard &&
                        state.Player1FlagPos.Row == to.Row &&
                        state.Player1FlagPos.Col == to.Col)
                    {
                        finalPieceAtTo.HasEnemyFlag = true;
                        state.IsPlayer1FlagOnBoard = false;
                    }
                }

                // check victory condition, piece with enemy flag reaches middle of its first row
                if (finalPieceAtTo.HasEnemyFlag)
                {
                    Position goal = finalPieceAtTo.Owner == Player.Player1
                        ? state.Player1FlagHome
                        : state.Player2FlagHome;

                    if (to.Row == goal.Row && to.Col == goal.Col)
                    {
                        state.Status = GameStatus.Finished;
                        state.Winner = finalPieceAtTo.Owner;
                        return true;
                    }
                }
            }

            // 3. if any flag carrier died in this move, drop the flag on that square
            // we only know the squares "from" and "to", since combat happens there

            // if movingPiece died while carrying flag
            if (movingPiece != null && movingPiece.IsDead && movingPiece.HasEnemyFlag)
            {
                if (movingPiece.Owner == Player.Player1)
                {
                    // Player1 was carrying Player2 flag
                    state.IsPlayer2FlagOnBoard = true;
                    state.Player2FlagPos = from;
                }
                else if (movingPiece.Owner == Player.Player2)
                {
                    // Player2 was carrying Player1 flag
                    state.IsPlayer1FlagOnBoard = true;
                    state.Player1FlagPos = from;
                }
                movingPiece.HasEnemyFlag = false;
            }

            // if defender died while carrying flag, drop on "to"
            if (targetPiece != null && targetPiece.IsDead && targetPiece.HasEnemyFlag)
            {
                if (targetPiece.Owner == Player.Player1)
                {
                    state.IsPlayer2FlagOnBoard = true;
                    state.Player2FlagPos = to;
                }
                else if (targetPiece.Owner == Player.Player2)
                {
                    state.IsPlayer1FlagOnBoard = true;
                    state.Player1FlagPos = to;
                }
                targetPiece.HasEnemyFlag = false;
            }

            // 4. if game not finished, switch turn
            if (state.Status == GameStatus.InProgress)
            {
                state.CurrentPlayer = state.CurrentPlayer == Player.Player1
                    ? Player.Player2
                    : Player.Player1;
            }

            return true;
        }
    }
}
