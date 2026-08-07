// ============================================
// 🔒 Finance roles matrix — permanent guard (S7-ROLES-GATE / البوابة أ)
//
// خلفية: المصفوفة الماليّة (9 endpoints) كان تحققها الوحيد سكربت boot **عابر**
// كتبه المبرمج في المرحلة 7 من S7 واختفى بنهاية الـ session. الملف ده هو
// تحويله لـ spec دائم — الشرط الملزم الأول قبل أي ربط frontend.
//
// 🔴 قاعدة الملف الأولى (بلاها الملف بيوافق على أي شيء):
//   `PLANNED_MATRIX` مكتوب **حرفياً بالإيد** من جدول المرحلة 3 في
//   `.claude/sessions/2026-07-16-s7-financial-boq/00-plan.md` (سطور 128–136).
//   ❌ ممنوع توليده من `finance.controller.ts` أو من أي metadata.
//   أي تعديل على صلاحيات endpoint لازم يعدّي على الجدول ده **يدوياً** —
//   وده بالظبط الاحتكاك المقصود.
//
// ⚠️ حدود الضمانة (نقلاً عن `05-principal-report.md`):
//   الملف ده يثبّت ما هو **مُعلَن في الـ metadata**. لا يثبت إطلاقاً أن
//   `RolesGuard` **ينفّذه فعلاً وقت التشغيل** — دي البوابة (ج):
//   HTTP integration tests بـ supertest (BACKLOG #5). مش بديل عنها.
// ============================================
import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RequestMethod } from '@nestjs/common';
import {
  PATH_METADATA,
  METHOD_METADATA,
  HTTP_CODE_METADATA,
} from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';
import { FinanceController } from './finance.controller';
import { ROLES_KEY } from '../../common/decorators';

// ─────────────────────────────────────────────────────────────
// الجدول المرجعي — literal، مصدره الخطة لا الكود
// ─────────────────────────────────────────────────────────────
interface PlannedRoute {
  handler: string;
  method: string;
  path: string;
  /**
   * `string[]` **متعمَّد** لا `UserRole[]`: لو الجدول اتقيّد بالـ enum يبقى
   * الـ tsc هو اللي بيفحص، والـ spec بيفحص "متطابق مع نفسه". فحص صحة
   * الأسماء لازم يجري **على الـ metadata وقت التشغيل** (اختبار مستقل تحت).
   */
  roles: string[];
  /** `undefined` = مفيش `@HttpCode` صريح على الـ handler. */
  httpCode?: number;
}

const PLANNED_MATRIX: PlannedRoute[] = [
  {
    handler: 'getSettings',
    method: 'GET',
    path: 'projects/:projectId/financial-settings',
    roles: ['SUPER_ADMIN', 'ACCOUNTANT', 'PROJECT_MANAGER'],
  },
  {
    handler: 'updateSettings',
    method: 'PATCH',
    path: 'projects/:projectId/financial-settings',
    roles: ['SUPER_ADMIN', 'ACCOUNTANT'],
  },
  {
    handler: 'getSummary',
    method: 'GET',
    path: 'projects/:projectId/financial-summary',
    roles: ['SUPER_ADMIN', 'ACCOUNTANT', 'PROJECT_MANAGER', 'CLIENT'],
  },
  {
    handler: 'getBOQTree',
    method: 'GET',
    path: 'projects/:projectId/boq',
    roles: ['SUPER_ADMIN', 'ACCOUNTANT', 'PROJECT_MANAGER', 'CLIENT'],
  },
  {
    handler: 'createBOQItem',
    method: 'POST',
    path: 'projects/:projectId/boq',
    roles: ['SUPER_ADMIN', 'ACCOUNTANT'],
  },
  {
    handler: 'createSubItem',
    method: 'POST',
    path: 'boq/:id/sub-items',
    roles: ['SUPER_ADMIN', 'ACCOUNTANT'],
  },
  {
    handler: 'updateBOQItem',
    method: 'PATCH',
    path: 'boq/:id',
    roles: ['SUPER_ADMIN', 'ACCOUNTANT'],
  },
  {
    handler: 'softDeleteBOQItem',
    method: 'DELETE',
    path: 'boq/:id',
    roles: ['SUPER_ADMIN', 'ACCOUNTANT'],
    httpCode: 200, // يرجّع البند المحذوف، مش 204
  },
  {
    handler: 'linkUpdate',
    method: 'PATCH',
    path: 'boq/:id/link-update',
    roles: [
      'SUPER_ADMIN',
      'ACCOUNTANT',
      'PROJECT_MANAGER',
      'SITE_ENGINEER',
      'SUPERVISOR',
    ],
  },
];

/** الأدوار السبعة كما في `schema.prisma:652` — literal، للمطابقة لا للاشتقاق. */
const PLANNED_ENUM_MEMBERS = [
  'SUPER_ADMIN',
  'PROJECT_MANAGER',
  'SITE_ENGINEER',
  'SUPERVISOR',
  'ACCOUNTANT',
  'WORKER',
  'CLIENT',
];

// ─────────────────────────────────────────────────────────────
// قرّاء الـ metadata
// ─────────────────────────────────────────────────────────────
const proto = FinanceController.prototype as unknown as Record<
  string,
  (...args: unknown[]) => unknown
>;

const handlerNames = Object.getOwnPropertyNames(FinanceController.prototype)
  .filter((name) => name !== 'constructor')
  .sort();

const readRoles = (handler: string): unknown =>
  Reflect.getMetadata(ROLES_KEY, proto[handler]);

const readMethod = (handler: string): string => {
  const raw = Reflect.getMetadata(METHOD_METADATA, proto[handler]) as
    | number
    | undefined;
  return raw === undefined ? 'NONE' : RequestMethod[raw];
};

const readPath = (handler: string): unknown =>
  Reflect.getMetadata(PATH_METADATA, proto[handler]);

const readHttpCode = (handler: string): unknown =>
  Reflect.getMetadata(HTTP_CODE_METADATA, proto[handler]);

describe('Finance roles matrix (metadata)', () => {
  // ───────────────────────────────────────────────────────────
  // 1) الحصر: لا endpoint زائد، ولا endpoint بلا @Roles
  // ───────────────────────────────────────────────────────────
  describe('حصر الـ handlers', () => {
    it('الـ controller فيه بالظبط الـ 9 handlers المخطَّطة — لا زيادة ولا نقصان', () => {
      expect(handlerNames).toEqual(
        PLANNED_MATRIX.map((r) => r.handler).sort(),
      );
    });

    /**
     * أخطر حالة في الملف كله: handler جديد **بلا `@Roles` إطلاقاً**.
     * `RolesGuard.canActivate` بيرجّع `true` لما `requiredRoles` فاضية أو
     * غير موجودة (`roles.guard.ts:35`) ⇒ الـ endpoint بيبقى مفتوح لكل دور
     * مصادَق عليه. الغياب مايبانش في جدول — لازم اختبار صريح عليه.
     */
    it('كل handler عليه @Roles غير فارغة (الغياب = endpoint مفتوح لكل الأدوار)', () => {
      const unguarded = handlerNames.filter((name) => {
        const roles = readRoles(name);
        return !Array.isArray(roles) || roles.length === 0;
      });
      expect(unguarded).toEqual([]);
    });

    it('مفيش @Roles على مستوى الـ class تتجاوز الـ handlers', () => {
      expect(Reflect.getMetadata(ROLES_KEY, FinanceController)).toBeUndefined();
    });

    it('الـ controller base path فاضي — المسارات كاملة على الـ handlers', () => {
      expect(Reflect.getMetadata(PATH_METADATA, FinanceController)).toBe('/');
    });
  });

  // ───────────────────────────────────────────────────────────
  // 2) الجدول التسعة، صفاً صفاً
  // ───────────────────────────────────────────────────────────
  describe.each(PLANNED_MATRIX)(
    '$method $path → $handler',
    ({ handler, method, path, roles, httpCode }) => {
      it('الـ HTTP method مطابق للخطة', () => {
        expect(readMethod(handler)).toBe(method);
      });

      it('الـ path مطابق للخطة حرفياً', () => {
        expect(readPath(handler)).toBe(path);
      });

      it('مجموعة الأدوار مطابقة للخطة بالظبط', () => {
        const actual = readRoles(handler) as string[];
        expect(Array.isArray(actual)).toBe(true);
        // مقارنة كمجموعة: الترتيب بلا دلالة أمنية، والعدد له دلالة.
        expect([...actual].sort()).toEqual([...roles].sort());
        expect(actual).toHaveLength(roles.length);
      });

      it('مفيش دور مكرَّر داخل نفس الـ handler', () => {
        const actual = readRoles(handler) as string[];
        expect(new Set(actual).size).toBe(actual.length);
      });

      it('الـ HTTP status code مطابق للخطة', () => {
        expect(readHttpCode(handler)).toBe(httpCode);
      });
    },
  );

  // ───────────────────────────────────────────────────────────
  // 3) صحة أسماء الأدوار — الفحص اللي الـ tsc ما كانش بيغطيه
  //    (API-ROLES-001؛ يفضل قائماً بعد التضييق كحارس وقت-تشغيل)
  // ───────────────────────────────────────────────────────────
  describe('صحة أسماء الأدوار مقابل enum UserRole', () => {
    /**
     * قاعدة #4 — أعمق طبقة قابلة للتمثيل: ما نكتفيش بـ `UserRole` المولَّد.
     * لو `prisma generate` فايت، الـ client بيحمل enum **قديم**، وكل فحص
     * مبني عليه بيوافق على أسماء ميتة. المصدر الحقيقي هو ملف الـ schema.
     */
    it('enum UserRole المولَّد مطابق لـ schema.prisma نصياً (يمسك client قديم)', () => {
      const schema = readFileSync(
        join(__dirname, '..', '..', '..', 'prisma', 'schema.prisma'),
        'utf8',
      );
      const block = /enum\s+UserRole\s*\{([^}]*)\}/.exec(schema);
      expect(block).not.toBeNull();

      const fromSchema = (block as RegExpExecArray)[1]
        .split('\n')
        .map((line) => line.replace(/\/\/.*$/, '').trim())
        .filter((line) => line.length > 0);

      expect(fromSchema.sort()).toEqual([...PLANNED_ENUM_MEMBERS].sort());
      expect(Object.keys(UserRole).sort()).toEqual(
        [...PLANNED_ENUM_MEMBERS].sort(),
      );
    });

    it('كل اسم دور في الـ metadata عضو فعلي في UserRole (يمسك أي typo)', () => {
      const validRoles = new Set<string>(Object.keys(UserRole));
      const offenders: string[] = [];

      for (const name of handlerNames) {
        const roles = (readRoles(name) as string[]) ?? [];
        for (const role of roles) {
          if (!validRoles.has(role)) offenders.push(`${name}: "${role}"`);
        }
      }

      expect(offenders).toEqual([]);
    });

    /**
     * assertion سالبة: تثبت إن الفحص فوق **بيعضّ**. لو الشرط اتقلب سهواً
     * (`has` بدل `!has`) الاختبار ده بيسقط فوراً.
     */
    it('نفس الفحص يرفض اسماً مزوّراً (إثبات إن الشرط مقلوب يسقط)', () => {
      const validRoles = new Set<string>(Object.keys(UserRole));
      expect(validRoles.has('ACCOUNTENT')).toBe(false); // typo واقعي من S7
      expect(validRoles.has('accountant')).toBe(false); // lowercase
      expect(validRoles.has('ADMIN')).toBe(false); // دور غير موجود
    });
  });

  // ───────────────────────────────────────────────────────────
  // 4) ثوابت دلالية أعلى من الجدول
  //    الجدول بيثبّت "الحالة"؛ دول بيثبّتوا "القاعدة" — تعديل غافل
  //    للجدول ينجو من (2) لكنه يسقط هنا.
  // ───────────────────────────────────────────────────────────
  describe('ثوابت الصلاحيات الماليّة', () => {
    const isMutating = (handler: string): boolean =>
      ['POST', 'PATCH', 'DELETE'].includes(readMethod(handler));

    it('CLIENT قارئ فقط — صفر endpoint كتابة يسمح له', () => {
      const violations = handlerNames.filter(
        (name) =>
          isMutating(name) &&
          ((readRoles(name) as string[]) ?? []).includes('CLIENT'),
      );
      expect(violations).toEqual([]);
    });

    it('WORKER مستبعَد من الوحدة الماليّة بالكامل (قراءةً وكتابةً)', () => {
      const violations = handlerNames.filter((name) =>
        ((readRoles(name) as string[]) ?? []).includes('WORKER'),
      );
      expect(violations).toEqual([]);
    });

    it('SUPER_ADMIN مذكور صراحةً في كل endpoint (لا اعتماد على bypass الحارس)', () => {
      const missing = handlerNames.filter(
        (name) =>
          !((readRoles(name) as string[]) ?? []).includes('SUPER_ADMIN'),
      );
      expect(missing).toEqual([]);
    });

    it('تعديل الإعدادات الماليّة محصور في SUPER_ADMIN + ACCOUNTANT', () => {
      // PROJECT_MANAGER يقرأ ولا يكتب — الأرقام دي بتحرّك كل رقم مالي تحتها.
      expect([...(readRoles('updateSettings') as string[])].sort()).toEqual([
        'ACCOUNTANT',
        'SUPER_ADMIN',
      ]);
    });
  });
});
