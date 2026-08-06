// ============================================
// MediaSecurityService — focused unit tests
//
// Covers the bits that are testable WITHOUT a live Supabase backend:
//   - assertPathBelongsToTenant rejects every shape of foreign / unsafe path
//   - generateUploadPath always scopes under {companyId}/{userId}/
//
// The fetch-based verifyUploadedFile is exercised via an integration-style
// test with global.fetch stubbed.
// ============================================
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MediaSecurityService } from './media-security.service';
import type { JwtPayload } from '../../common/decorators';

// Stub the Supabase JS client — it is created in the constructor.
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({
    storage: {
      from: () => ({
        createSignedUploadUrl: jest.fn(),
        createSignedUrl: jest.fn(),
        remove: jest.fn(),
      }),
    },
  }),
}));

const user: JwtPayload = {
  sub: 'sup-1',
  email: 'eng@a.test',
  userId: 'user-eng',
  companyId: 'company-a',
  role: 'SITE_ENGINEER',
  permissions: [],
};

describe('MediaSecurityService', () => {
  let service: MediaSecurityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaSecurityService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'NEXT_PUBLIC_SUPABASE_URL') return 'https://stub.supabase.co';
              if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'stub-key';
              throw new Error('unexpected ' + key);
            },
          },
        },
      ],
    }).compile();
    service = module.get(MediaSecurityService);
  });

  describe('assertPathBelongsToTenant', () => {
    it('accepts a well-formed path under the user\'s company prefix', () => {
      expect(() =>
        service.assertPathBelongsToTenant(user, 'company-a/user-eng/abc.jpg'),
      ).not.toThrow();
    });

    it('rejects a path under another tenant\'s prefix', () => {
      expect(() =>
        service.assertPathBelongsToTenant(user, 'company-b/user-eng/abc.jpg'),
      ).toThrow(BadRequestException);
    });

    it('rejects path traversal attempts even within the right prefix', () => {
      expect(() =>
        service.assertPathBelongsToTenant(user, 'company-a/user-eng/../etc/passwd'),
      ).toThrow(BadRequestException);
    });

    it('rejects absolute paths', () => {
      expect(() =>
        service.assertPathBelongsToTenant(user, '/company-a/user-eng/abc.jpg'),
      ).toThrow(BadRequestException);
    });

    it('rejects Windows-style backslashes', () => {
      expect(() =>
        service.assertPathBelongsToTenant(user, 'company-a\\user-eng\\abc.jpg'),
      ).toThrow(BadRequestException);
    });

    it('rejects an empty string', () => {
      expect(() => service.assertPathBelongsToTenant(user, '')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('generateUploadPath', () => {
    it('scopes the path under {companyId}/{userId}/', () => {
      const { bucket, path } = service.generateUploadPath(user, 'IMAGE');
      expect(bucket).toBe('updates-media');
      expect(path).toMatch(/^company-a\/user-eng\/[a-f0-9-]+\.jpg$/);
    });

    it('produces different paths on each call (no collisions)', () => {
      const a = service.generateUploadPath(user, 'IMAGE');
      const b = service.generateUploadPath(user, 'IMAGE');
      expect(a.path).not.toBe(b.path);
    });

    it('uses .mp4 extension for VIDEO and .pdf for DOCUMENT', () => {
      expect(service.generateUploadPath(user, 'VIDEO').path).toMatch(/\.mp4$/);
      expect(service.generateUploadPath(user, 'DOCUMENT').path).toMatch(/\.pdf$/);
    });
  });

  describe('verifyUploadedFile', () => {
    let originalFetch: typeof fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });
    afterEach(() => {
      global.fetch = originalFetch;
    });

    /** Minimal valid PNG: 8-byte signature + IHDR chunk start. */
    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89,
    ]);

    function stubFetch(
      headResp: { ok: boolean; status: number; contentLength?: string },
      rangeResp: { ok: boolean; status: number; bytes: Buffer },
    ) {
      global.fetch = jest.fn(async (_url: unknown, init?: RequestInit) => {
        if (init?.method === 'HEAD') {
          return {
            ok: headResp.ok,
            status: headResp.status,
            headers: new Headers(
              headResp.contentLength
                ? { 'content-length': headResp.contentLength }
                : {},
            ),
          } as Response;
        }
        return {
          ok: rangeResp.ok,
          status: rangeResp.status,
          arrayBuffer: async () => rangeResp.bytes.buffer.slice(
            rangeResp.bytes.byteOffset,
            rangeResp.bytes.byteOffset + rangeResp.bytes.byteLength,
          ),
        } as Response;
      }) as unknown as typeof fetch;
    }

    it('accepts a real PNG declared as IMAGE', async () => {
      stubFetch(
        { ok: true, status: 200, contentLength: String(pngBytes.length) },
        { ok: true, status: 206, bytes: pngBytes },
      );

      const result = await service.verifyUploadedFile(
        'updates-media',
        'company-a/user-eng/abc.png',
        'IMAGE',
      );

      expect(result.mime).toBe('image/png');
      expect(result.size).toBe(pngBytes.length);
      expect(result.extension).toBe('png');
    });

    it('rejects a PNG when the caller declared DOCUMENT', async () => {
      stubFetch(
        { ok: true, status: 200, contentLength: String(pngBytes.length) },
        { ok: true, status: 206, bytes: pngBytes },
      );

      await expect(
        service.verifyUploadedFile(
          'updates-media',
          'company-a/user-eng/abc.pdf',
          'DOCUMENT',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects empty files', async () => {
      stubFetch(
        { ok: true, status: 200, contentLength: '0' },
        { ok: true, status: 206, bytes: Buffer.alloc(0) },
      );

      await expect(
        service.verifyUploadedFile('updates-media', 'company-a/u/x.jpg', 'IMAGE'),
      ).rejects.toThrow(/فارغ|غير صالح/);
    });

    it('rejects oversize files based on policy.maxSize', async () => {
      const tooBig = String(50 * 1024 * 1024); // 50MB declared, IMAGE cap is 10MB
      stubFetch(
        { ok: true, status: 200, contentLength: tooBig },
        { ok: true, status: 206, bytes: pngBytes },
      );

      await expect(
        service.verifyUploadedFile('updates-media', 'company-a/u/x.jpg', 'IMAGE'),
      ).rejects.toThrow(/يتجاوز/);
    });

    it('throws NotFound when storage HEAD says 404', async () => {
      stubFetch(
        { ok: false, status: 404 },
        { ok: false, status: 404, bytes: Buffer.alloc(0) },
      );

      await expect(
        service.verifyUploadedFile('updates-media', 'company-a/u/x.jpg', 'IMAGE'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an unrecognized blob', async () => {
      // Random bytes that file-type cannot identify
      const junk = Buffer.from('not-an-image-at-all-just-text-bytes-here-please');
      stubFetch(
        { ok: true, status: 200, contentLength: String(junk.length) },
        { ok: true, status: 206, bytes: junk },
      );

      await expect(
        service.verifyUploadedFile('updates-media', 'company-a/u/x.jpg', 'IMAGE'),
      ).rejects.toThrow(/غير معروف|تالف/);
    });
  });
});
