using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

namespace Game.Api.Hubs
{
    public class GameHub : Hub
    {
        // each game id is a SignalR group
        public Task JoinGame(string gameId)
        {
            return Groups.AddToGroupAsync(Context.ConnectionId, gameId);
        }
    }
}
