// ============================================
// Auth Controller — register, login, refresh, logout
//
// Cookie strategy (C11):
//   The refresh token NEVER appears in the response body. It lives in an
//   httpOnly + Secure + SameSite=Strict cookie that the browser sends back
//   automatically on `/auth/refresh` and `/auth/logout`.
//
//   - httpOnly      → JavaScript can't read it (immune to XSS exfiltration)
//   - Secure        → only sent over HTTPS (production only)
//   - SameSite=Strict → never sent on cross-site requests (CSRF mitigation)
//   - path=/api/v1/auth → narrows the surface — never sent on other routes
//
// Rotation:
//   Every successful /refresh issues a NEW refresh token. The cookie is
//   replaced. Stolen tokens become useless on the legitimate user's next
//   refresh — they're auto-invalidated by Supabase.
// ============================================
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterCompanyDto, LoginDto } from './dto';
import { Public } from '../../common/decorators';

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const REFRESH_COOKIE_PATH = '/api/v1/auth';

function refreshCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict';
  path: string;
  maxAge: number;
  signed: boolean;
} {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,           // browsers reject Secure cookies on http://localhost
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    signed: Boolean(process.env.COOKIE_SECRET), // signed when secret is configured
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/register
   * Register new company + super admin.
   * Strict 5/min throttle — registration is rare and abused by bots.
   * `req` is threaded through for the audit log (captures IP + user-agent).
   */
  @Public()
  @Post('register')
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  async register(@Body() dto: RegisterCompanyDto, @Req() req: Request) {
    return this.authService.registerCompany(dto, req);
  }

  /**
   * POST /auth/login
   * Sets the refresh-token cookie. Body contains accessToken + user.
   */
  @Public()
  @Post('login')
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);

    // Move refresh token into the cookie — strip from the JSON response.
    res.cookie(
      REFRESH_COOKIE_NAME,
      result.refreshToken,
      refreshCookieOptions(),
    );

    return {
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
      user: result.user,
    };
  }

  /**
   * POST /auth/refresh
   * Reads refresh token from the cookie. Rotates the cookie on every call.
   */
  @Public()
  @Post('refresh')
  @Throttle({ auth: { limit: 30, ttl: 60_000 } }) // 30/min — bursty UX is OK here
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Prefer signed cookies when COOKIE_SECRET is configured (production);
    // fall back to unsigned for dev convenience.
    const signed = (req as Request & { signedCookies?: Record<string, string> })
      .signedCookies?.[REFRESH_COOKIE_NAME];
    const unsigned = (req as Request & { cookies?: Record<string, string> })
      .cookies?.[REFRESH_COOKIE_NAME];
    const currentToken = signed ?? unsigned;

    const result = await this.authService.refreshToken(currentToken);

    // Rotate — replace the cookie with the new refresh token
    res.cookie(
      REFRESH_COOKIE_NAME,
      result.refreshToken,
      refreshCookieOptions(),
    );

    return {
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
    };
  }

  /**
   * POST /auth/logout
   * Clears the refresh-token cookie + best-effort invalidates Supabase session.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Headers('authorization') auth: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const accessToken = auth?.replace(/^Bearer\s+/i, '');
    const result = await this.authService.logout(accessToken);

    // Clear the cookie. The options (path, sameSite, etc.) MUST match the
    // ones used when setting it — otherwise the browser keeps it.
    res.clearCookie(REFRESH_COOKIE_NAME, {
      path: REFRESH_COOKIE_PATH,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return result;
  }
}
