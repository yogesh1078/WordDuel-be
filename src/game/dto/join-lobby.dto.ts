import { IsString, Length } from 'class-validator';

export class JoinLobbyDto {
  @IsString()
  @Length(3, 24)
  username!: string;
}
