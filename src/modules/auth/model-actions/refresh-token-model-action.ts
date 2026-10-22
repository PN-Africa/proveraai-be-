import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AbstractModel } from '../../../util/abstract-model-action.js';
import { RefreshTokenModel } from '../models/refresh-token.model.js';

@Injectable()
export class RefreshTokenModelAction extends AbstractModel<RefreshTokenModel> {
  constructor(
    @InjectRepository(RefreshTokenModel)
    private readonly refreshTokenRepository: Repository<RefreshTokenModel>,
  ) {
    super(refreshTokenRepository, RefreshTokenModel);
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenModel | null> {
    return this.refreshTokenRepository.findOne({ where: { tokenHash } });
  }

  // Revokes the token only if it is still active, in one statement. Returns
  // false when another request revoked it first, so a token rotates once.
  async revokeIfActive(id: string, replacedById: string | null): Promise<boolean> {
    const result = await this.refreshTokenRepository.update(
      { id, revokedAt: IsNull() },
      { revokedAt: new Date(), replacedById },
    );
    return (result.affected ?? 0) > 0;
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async revokeAllForAccount(accountId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { accountId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }
}
