import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

@Injectable()
export class AnalystGuard implements CanActivate {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const memberId =
      req.body?.createdById ??
      req.body?.memberId ??
      req.query?.memberId;

    if (!memberId) {
      throw new ForbiddenException('MemberId requis pour cette action');
    }

    const user = await this.usersRepo.findOne({ where: { id: Number(memberId) } });
    if (!user) {
      throw new ForbiddenException('Utilisateur introuvable');
    }

    const role = String(user.role || '').toUpperCase();
    if (role !== 'ANALYST' && role !== 'CREATOR') {
      throw new ForbiddenException('Rôle insuffisant');
    }

    return true;
  }
}
