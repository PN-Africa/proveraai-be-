import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

// Hashes and checks passwords with argon2id
@Injectable()
export class PasswordService {
  private dummyHash?: Promise<string>;

  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false; // malformed hash
    }
  }

  async verifyDummy(password: string): Promise<void> {
    this.dummyHash ??= argon2.hash(randomUUID(),{ type: argon2.argon2id });
    await this.verify(await this.dummyHash, password);
  }
}
