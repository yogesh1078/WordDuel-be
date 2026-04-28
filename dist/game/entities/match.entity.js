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
exports.Match = exports.MatchStatus = void 0;
const typeorm_1 = require("typeorm");
const player_entity_1 = require("./player.entity");
var MatchStatus;
(function (MatchStatus) {
    MatchStatus["ONGOING"] = "ongoing";
    MatchStatus["COMPLETED"] = "completed";
})(MatchStatus || (exports.MatchStatus = MatchStatus = {}));
let Match = class Match {
    id;
    player1;
    player2;
    score1;
    score2;
    status;
    createdAt;
    updatedAt;
};
exports.Match = Match;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Match.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => player_entity_1.Player, { eager: true }),
    (0, typeorm_1.JoinColumn)({ name: 'player1Id' }),
    __metadata("design:type", player_entity_1.Player)
], Match.prototype, "player1", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => player_entity_1.Player, { eager: true }),
    (0, typeorm_1.JoinColumn)({ name: 'player2Id' }),
    __metadata("design:type", player_entity_1.Player)
], Match.prototype, "player2", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], Match.prototype, "score1", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], Match.prototype, "score2", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: MatchStatus, default: MatchStatus.ONGOING }),
    __metadata("design:type", String)
], Match.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Match.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Match.prototype, "updatedAt", void 0);
exports.Match = Match = __decorate([
    (0, typeorm_1.Entity)('matches')
], Match);
//# sourceMappingURL=match.entity.js.map