import { Server, Socket } from 'socket.io';
import { JoinLobbyDto } from './dto/join-lobby.dto';
import { SubmitGuessDto } from './dto/submit-guess.dto';
import { GameService } from './game.service';
export declare class GameGateway {
    private readonly gameService;
    server: Server;
    constructor(gameService: GameService);
    private readonly betweenTicksDelayMs;
    handleDisconnect(client: Socket): void;
    onJoinLobby(client: Socket, body: JoinLobbyDto): Promise<void>;
    onSubmitGuess(client: Socket, body: SubmitGuessDto): Promise<void>;
    onLeaveLobby(client: Socket): Promise<void>;
    private startTick;
    private resolveTick;
    private finishRound;
}
