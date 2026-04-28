"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const game_module_1 = require("./game/game.module");
const player_entity_1 = require("./game/entities/player.entity");
const match_entity_1 = require("./game/entities/match.entity");
const round_entity_1 = require("./game/entities/round.entity");
const guess_entity_1 = require("./game/entities/guess.entity");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forRoot({
                type: 'postgres',
                ...(process.env.DATABASE_URL
                    ? {
                        url: process.env.DATABASE_URL,
                        ssl: { rejectUnauthorized: false },
                    }
                    : {
                        host: process.env.DB_HOST ?? 'localhost',
                        port: Number(process.env.DB_PORT ?? 5432),
                        username: process.env.DB_USER ?? 'postgres',
                        password: process.env.DB_PASSWORD ?? 'postgres',
                        database: process.env.DB_NAME ?? 'hidden_word_duel',
                    }),
                entities: [player_entity_1.Player, match_entity_1.Match, round_entity_1.Round, guess_entity_1.Guess],
                synchronize: true,
            }),
            game_module_1.GameModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map