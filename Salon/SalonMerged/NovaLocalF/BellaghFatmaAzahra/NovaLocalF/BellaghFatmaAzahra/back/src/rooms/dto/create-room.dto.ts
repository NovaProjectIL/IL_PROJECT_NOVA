import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class CreateRoomDto {
  @IsOptional()
  @IsString()
 
  @MaxLength(30)
  displayName?: string;
}