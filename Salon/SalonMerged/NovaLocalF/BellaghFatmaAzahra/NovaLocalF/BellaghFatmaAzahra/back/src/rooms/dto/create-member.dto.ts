import { IsOptional, IsString, MinLength, MaxLength, Length, Matches } from 'class-validator';

export class CreateMemberDto {
  @IsOptional()
  @IsString()
 
  @MaxLength(30)
  displayName?: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^[A-Z0-9]{6}$/)
  codeRoom: string;
}