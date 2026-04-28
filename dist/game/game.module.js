"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const game_gateway_1 = require("./game.gateway");
const game_service_1 = require("./game.service");
const player_entity_1 = require("./entities/player.entity");
const match_entity_1 = require("./entities/match.entity");
const round_entity_1 = require("./entities/round.entity");
const guess_entity_1 = require("./entities/guess.entity");
let GameModule = class GameModule {
};
exports.GameModule = GameModule;
exports.GameModule = GameModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([player_entity_1.Player, match_entity_1.Match, round_entity_1.Round, guess_entity_1.Guess])],
        providers: [game_gateway_1.GameGateway, game_service_1.GameService],
    })
], GameModule);
//# sourceMappingURL=game.module.js.map