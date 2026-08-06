// ============================================
// Transform Interceptor
// Wraps all responses in a consistent format
// { success: true, data: {...}, meta: {...} }
// ============================================
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    timestamp: string;
  };
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data: unknown) => {
        // If data already has our format, return as is
        if (data && typeof data === 'object' && 'success' in data) {
          return data as ApiResponse<T>;
        }

        // Handle paginated responses
        if (
          data &&
          typeof data === 'object' &&
          'items' in data &&
          'total' in data
        ) {
          const paginatedData = data as {
            items: T;
            total: number;
            page?: number;
            limit?: number;
          };
          return {
            success: true,
            data: paginatedData.items,
            meta: {
              total: paginatedData.total,
              page: paginatedData.page,
              limit: paginatedData.limit,
              timestamp: new Date().toISOString(),
            },
          };
        }

        return {
          success: true,
          data: data as T,
          meta: {
            timestamp: new Date().toISOString(),
          },
        };
      }),
    );
  }
}
