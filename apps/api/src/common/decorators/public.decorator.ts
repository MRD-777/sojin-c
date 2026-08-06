// ============================================
// @Public() Decorator
// Mark endpoints as public (no auth required)
// ============================================
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
