"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Guess = void 0;
const typeorm_1 = require("typeorm");
const round_entity_1 = require("./round.entity");
const player_entity_1 = require("./player.entity");
let Guess = class Guess {
    id;
    round;
    player;
    guess;
    isCorrect;
    timestamp;
};
exports.Guess = Guess;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Guess.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => round_entity_1.Round, { eager: true }),
    (0, typeorm_1.JoinColumn)({ name: 'roundId' }),
    __metadata("design:type", round_entity_1.Round)
], Guess.prototype, "round", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => player_entity_1.Player, { eager: true }),
    (0, typeorm_1.JoinColumn)({ name: 'playerId' }),
    __metadata("design:type", player_entity_1.Player)
], Guess.prototype, "player", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Guess.prototype, "guess", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Boolean)
], Guess.prototype, "isCorrect", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Date)
], Guess.prototype, "timestamp", void 0);
exports.Guess = Guess = __decorate([
    (0, typeorm_1.Entity)('guesses')
], Guess);
//# sourceMappingURL=guess.entity.js.map