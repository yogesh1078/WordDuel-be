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
exports.Round = void 0;
const typeorm_1 = require("typeorm");
const match_entity_1 = require("./match.entity");
const player_entity_1 = require("./player.entity");
let Round = class Round {
    id;
    match;
    word;
    revealedTiles;
    winner;
    roundNumber;
    createdAt;
    endedAt;
};
exports.Round = Round;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Round.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => match_entity_1.Match, { eager: true }),
    (0, typeorm_1.JoinColumn)({ name: 'matchId' }),
    __metadata("design:type", match_entity_1.Match)
], Round.prototype, "match", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Round.prototype, "word", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json' }),
    __metadata("design:type", Array)
], Round.prototype, "revealedTiles", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => player_entity_1.Player, { nullable: true, eager: true }),
    (0, typeorm_1.JoinColumn)({ name: 'winnerId' }),
    __metadata("design:type", Object)
], Round.prototype, "winner", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], Round.prototype, "roundNumber", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Round.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Round.prototype, "endedAt", void 0);
exports.Round = Round = __decorate([
    (0, typeorm_1.Entity)('rounds')
], Round);
//# sourceMappingURL=round.entity.js.map