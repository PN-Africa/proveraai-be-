import { Injectable, NotImplementedException } from '@nestjs/common';

// Sub-services live in services/ and each does one job. The main
// auth.service.ts orchestrates them. This one is a skeleton.
// TODO(template): implement (JWT, session store, etc.)
@Injectable()
export class TokenService {
  sign(_payload: Record<string, unknown>): string {
    throw new NotImplementedException();
  }

  verify(_token: string): Record<string, unknown> {
    throw new NotImplementedException();
  }
}
