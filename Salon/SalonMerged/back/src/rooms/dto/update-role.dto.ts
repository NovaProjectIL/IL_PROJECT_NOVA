import { IsIn, IsInt, IsString, Min } from 'class-validator';

export class UpdateRoleDto {
  @IsString()
  codeRoom: string;

  @IsInt()
  @Min(1)
  requesterId: number;

  @IsInt()
  @Min(1)
  targetMemberId: number;

  @IsString()
  @IsIn(['ANALYST', 'OBSERVER'])
  role: 'ANALYST' | 'OBSERVER';
}
