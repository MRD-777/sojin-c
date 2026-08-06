// ============================================
// JWT Strategy
// Validates Supabase JWT tokens and loads user data
// ============================================
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { passportJwtSecret } from 'jwks-rsa';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/decorators';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    // Supabase signs access tokens with an ASYMMETRIC key (ES256, EC P-256),
    // not the legacy HS256 shared secret. We therefore verify each token's
    // signature against the project's published JWKS public key (looked up by
    // the token's `kid`), pinning:
    //   - algorithms: ['ES256']  → blocks alg-confusion (e.g. forged HS256).
    //   - issuer/audience         → the token must come from this project's
    //                               GoTrue and be minted for a logged-in user.
    const supabaseUrl = configService.get<string>('NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseUrl) {
      throw new Error(
        'FATAL: NEXT_PUBLIC_SUPABASE_URL is required to verify Supabase JWTs',
      );
    }
    const authBase = `${supabaseUrl.replace(/\/$/, '')}/auth/v1`;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['ES256'],
      issuer: authBase,
      audience: 'authenticated',
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: `${authBase}/.well-known/jwks.json`,
      }),
    });
  }

  /**
   * Called after JWT token is verified.
   * Loads user from DB, checks active status, builds permissions.
   */
  async validate(payload: { sub?: string }): Promise<JwtPayload> {
    const supabaseAuthId = payload.sub;

    if (!supabaseAuthId) {
      throw new UnauthorizedException('رمز الدخول غير صالح');
    }

    // Find user by Supabase auth ID
    const user = await this.prisma.user.findFirst({
      where: {
        supabaseAuthId,
        deletedAt: null,
      },
      include: {
        company: {
          select: {
            id: true,
            subscriptionStatus: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('المستخدم غير موجود');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('الحساب معطل — تواصل مع المسؤول');
    }

    if (user.company.deletedAt) {
      throw new UnauthorizedException('حساب الشركة غير متاح');
    }

    if (user.company.subscriptionStatus === 'EXPIRED') {
      throw new UnauthorizedException('اشتراك الشركة منتهي — يرجى التجديد');
    }

    // Build user permissions (role defaults + custom)
    const customPermissions: string[] = Array.isArray(user.customPermissions)
      ? (user.customPermissions as string[])
      : [];

    // A2: `lastLogin` is updated ONCE per actual login by `AuthService.login()`.
    // Writing here on every JWT validation turned the column into a "lastRequest"
    // counter and added a DB write to every authenticated request — a write
    // hotspot at scale and a corruption of the column's semantics.

    return {
      sub: supabaseAuthId,
      email: user.email,
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
      permissions: customPermissions,
    };
  }
}
