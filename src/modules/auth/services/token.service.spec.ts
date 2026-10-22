import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '../enums/role.enum.js';
import { JWT_ISSUER, TokenService } from './token.service.js';

const SECRET = 'test-secret-that-is-at-least-32-characters-long';
const config = {
  getOrThrow: (key: string) => ({ accessTokenTtlMinutes: 15 })[key],
} as unknown as ConfigService;

const signer = (secret = SECRET, issuer = JWT_ISSUER) =>
  new JwtService({ secret, signOptions: { algorithm: 'HS256', issuer } });

const service = new TokenService(
  new JwtService({
    secret: SECRET,
    signOptions: { algorithm: 'HS256', expiresIn: 900, issuer: JWT_ISSUER },
  }),
  config,
);
const nowSeconds = () => Math.floor(Date.now() / 1000);
const account = { id: 'account-1', role: Role.ANALYST };

describe('TokenService', () => {
  it('signs a token that verifies back to the same user', () => {
    const { token, expiresAt } = service.signAccessToken(account);
    const user = service.verifyAccessToken(token);

    expect(user).toMatchObject({ id: 'account-1', role: Role.ANALYST });
    expect(user.jti).toEqual(expect.any(String));
    expect(user.exp - user.iat).toBe(900);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('puts only the user id, role and token id in the payload (AR-12)', () => {
    const { token } = service.signAccessToken(account);
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'iss', 'jti', 'role', 'sub']);
  });

  it('rejects a token with a tampered payload', () => {
    const [header, , signature] = service.signAccessToken(account).token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ sub: 'account-1', role: Role.ADMIN, jti: 'x', iss: JWT_ISSUER }),
    ).toString('base64url');
    expect(() => service.verifyAccessToken(`${header}.${forged}.${signature}`)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token signed with another secret', () => {
    const token = signer('another-secret-that-is-at-least-32-chars').sign({
      sub: 'account-1',
      role: Role.ADMIN,
      jti: 'x',
    });
    expect(() => service.verifyAccessToken(token)).toThrow(UnauthorizedException);
  });

  it('rejects an unsigned "alg: none" token', () => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      sub: 'account-1',
      role: Role.ADMIN,
      jti: 'x',
      iss: JWT_ISSUER,
      exp: nowSeconds() + 60,
    })}.`;
    expect(() => service.verifyAccessToken(token)).toThrow(UnauthorizedException);
  });

  it('rejects a token from another issuer', () => {
    const token = signer(SECRET, 'someone-else').sign({ sub: 'a', role: Role.ADMIN, jti: 'x' });
    expect(() => service.verifyAccessToken(token)).toThrow(UnauthorizedException);
  });

  it('rejects a token with an unknown role', () => {
    const token = signer().sign({ sub: 'a', role: 'SUPERUSER', jti: 'x' });
    expect(() => service.verifyAccessToken(token)).toThrow(UnauthorizedException);
  });

  it('rejects an expired token, but logout can still read it', () => {
    const token = signer().sign({
      sub: 'account-1',
      role: Role.ANALYST,
      jti: 'old',
      exp: nowSeconds() - 10,
    });
    expect(() => service.verifyAccessToken(token)).toThrow(UnauthorizedException);
    expect(service.verifyAccessTokenIgnoringExpiry(token).jti).toBe('old');
  });
});
