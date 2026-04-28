import {
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class SubmitGuessDto {
  @IsUUID()
  roundId!: string;

  @IsString()
  @MaxLength(64)
  guessText!: string;

  @IsOptional()
  @IsISO8601()
  timestamp?: string;
}
