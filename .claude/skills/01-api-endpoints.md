---
name: api-endpoints
description: Use when creating or modifying any NestJS API endpoint, controller, or service method. Enforces validation, authorization, response format, error handling, idempotency, and logging standards for the construction SaaS API.
---

# API Endpoints — Safety Rules

> ⚠️ هذا المشروع يدير عقود ومدفوعات بقيمة ملايين. كل endpoint غلط = خسارة فلوس + مسؤولية قانونية.
> قبل أي endpoint اسأل: لو حد بنية سيئة، إيه أسوأ شي ممكن يعمله بالـ endpoint ده؟

---

## القواعد الأساسية (Non-negotiable)

### 1. Validation إجباري على كل input

كل DTO لازم يستخدم `class-validator`. **مفيش endpoint بيقبل `any` أو `Record<string, unknown>` كـ body**.

✅ صح:
```typescript
// modules/payments/dto/create-payment.dto.ts
import { IsUUID, IsNumber, IsEnum, IsDateString, Min, Max, IsString, MaxLength, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentType, PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @IsUUID('4', { message: 'معرّف المشروع غير صالح' })
  projectId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'المبلغ يجب أن يكون رقماً بحد أقصى منزلتين عشريتين' })
  @Min(0.01, { message: 'المبلغ يجب أن يكون أكبر من صفر' })
  @Max(999_999_999.99, { message: 'المبلغ يتجاوز الحد المسموح' })
  amount: number;

  @IsEnum(PaymentType, { message: 'نوع الدفعة غير صالح' })
  type: PaymentType;

  @IsEnum(PaymentMethod, { message: 'طريقة الدفع غير صالحة' })
  method: PaymentMethod;

  @IsDateString({}, { message: 'تاريخ الدفع غير صالح' })
  date: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'الوصف يتجاوز 500 حرف' })
  description?: string;
}
```

❌ غلط — كارثة:
```typescript
@Post()
createPayment(@Body() body: any) {  // ⛔ ممنوع تماماً
  return this.paymentsService.create(body);
}
```

**القواعد:**
- كل number له `@Min` و `@Max` (حتى لو الـ business logic بتفلتر بعدها)
- كل string له `@MaxLength` (default sane = 255)
- كل enum يستخدم `@IsEnum(EnumFromPrisma)` — لا تكرر الـ enums يدوياً
- كل UUID يستخدم `@IsUUID('4')`
- كل date يستخدم `@IsDateString` ثم تحوّل بـ `new Date()` في الـ service
- المبالغ المالية: `@IsNumber({ maxDecimalPlaces: 2 })` + `Decimal` في Prisma

### 2. Global ValidationPipe مع whitelist + forbidNonWhitelisted

في `main.ts`:
```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,              // يحذف الـ properties اللي مش في الـ DTO
    forbidNonWhitelisted: true,   // يرفض الـ request لو فيه properties زيادة
    transform: true,               // يحوّل الـ types تلقائي
    transformOptions: { enableImplicitConversion: false },
  }),
);
```

**ليه:** لو client بعت `{ amount: 100, isApproved: true }` على create payment، الـ `isApproved` يترفض. لو ما عملناش `forbidNonWhitelisted`، attacker يقدر يبعت properties إضافية تتسرب لقاعدة البيانات (mass assignment).

### 3. كل endpoint له role محدد — مفيش endpoint بدون authorization

الـ `JwtAuthGuard` global بالفعل — أي endpoint مش `@Public()` بيتطلب JWT.
الـ `RolesGuard` و `PermissionsGuard` global — استخدم `@Roles()` على كل endpoint.

✅ صح:
```typescript
@Controller('payments')
export class PaymentsController {
  @Post()
  @Roles('SUPER_ADMIN', 'ACCOUNTANT', 'PROJECT_MANAGER')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreatePaymentDto, @Req() req: Request) {
    return this.paymentsService.create(user, dto, req);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ACCOUNTANT', 'PROJECT_MANAGER', 'CLIENT')
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.findOne(user, id);  // ownership check جوّا الـ service
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')  // ⚠️ Soft delete للمدفوعات — SUPER_ADMIN فقط
  delete(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.paymentsService.softDelete(user, id, req);
  }
}
```

❌ غلط:
```typescript
@Post()  // ⛔ مفيش @Roles — يعني WORKER يقدر يضيف مدفوعات!
create(@Body() dto: CreatePaymentDto) {
  return this.paymentsService.create(dto);
}
```

**القاعدة الذهبية:** لو نسيت `@Roles`، اعتبره bug خطير. الـ default المفروض يكون: لا أحد يقدر يدخل.

### 4. Ownership Check جوّا الـ Service — مش بس الـ Role

الـ Role بيقول "ACCOUNTANT يقدر يشوف payments". لكن **أي accountant؟ من أي شركة؟**

✅ صح — pattern من `projects.service.ts`:
```typescript
async findOne(user: JwtPayload, id: string) {
  const payment = await this.prisma.payment.findFirst({
    where: {
      id,
      project: { companyId: user.companyId },  // 🔒 multi-tenant
      ...this.prisma.softDeleteFilter,
    },
    include: { project: { select: { id: true, clientId: true } } },
  });

  if (!payment) throw new NotFoundException('الدفعة غير موجودة');

  // ownership: CLIENT يشوف مدفوعات مشروعه فقط
  if (user.role === 'CLIENT' && payment.project.clientId !== user.userId) {
    throw new NotFoundException('الدفعة غير موجودة');  // ⚠️ NotFound مش Forbidden — ما نكشفش وجودها
  }

  return payment;
}
```

❌ غلط — كارثي:
```typescript
async findOne(id: string) {
  return this.prisma.payment.findUnique({ where: { id } });  // ⛔ أي حد يشوف مدفوعات أي شركة
}
```

### 5. Response Format موحد — Don't break the contract

الـ `TransformInterceptor` global بيلف كل response. **لا ترجع responses مخصصة من الـ controllers**.

✅ صح — ارجع الـ data raw، الـ interceptor يلفه:
```typescript
async findAll(user: JwtPayload, query: ListProjectsQueryDto) {
  // ...
  return { items, total, page, limit, totalPages };  // الـ interceptor يحوّلها للـ pagination format
}
```

❌ غلط:
```typescript
async findAll() {
  return { success: true, data: [...], customField: '...' };  // ⛔ بتعمل double-wrap
}
```

### 6. لا تكشف internal errors للـ client أبداً

الـ `GlobalExceptionFilter` بيتعامل مع الـ exceptions. **لا تـ catch ثم return error string من الـ controller**.

✅ صح:
```typescript
async create(user: JwtPayload, dto: CreatePaymentDto, req: Request) {
  try {
    return await this.prisma.payment.create({ data: { ... } });
  } catch (error) {
    this.logger.error(
      `Payment creation failed for project ${dto.projectId}, user ${user.userId}`,
      error instanceof Error ? error.stack : String(error),
    );

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        throw new BadRequestException('المشروع المحدد غير موجود');
      }
    }

    throw new InternalServerErrorException('فشل في إنشاء الدفعة — حاول مجدداً');
    // ⚠️ مفيش error.message للـ client — ممكن يحتوي على schema details
  }
}
```

❌ غلط — تسريب معلومات:
```typescript
catch (error) {
  return { error: error.message };  // ⛔ ممكن يحتوي SQL, file paths, stack traces
}
```

### 7. Logging بـ context كامل — server-side فقط

كل service لازم عنده `Logger` instance. كل error مهم لازم يُسجَّل مع: userId, companyId, entityId, action.

✅ صح:
```typescript
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  async create(user: JwtPayload, dto: CreatePaymentDto, req: Request) {
    this.logger.log(`Payment create attempt: user=${user.userId} company=${user.companyId} project=${dto.projectId} amount=${dto.amount}`);
    // ...
  }
}
```

**ممنوع تماماً log:**
- Passwords حتى الـ hashes
- JWT tokens (لا access ولا refresh)
- بيانات بطاقات أو حسابات بنكية كاملة
- محتوى رسائل الـ chat الخاصة

### 8. Idempotency للعمليات المالية والحساسة

أي endpoint بيعمل create/update لـ payment، invoice، update approval، أو أي حاجة financial — لازم يدعم Idempotency-Key header.

✅ صح:
```typescript
// common/decorators/idempotency-key.decorator.ts
export const IdempotencyKey = createParamDecorator(
  (_, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const key = req.headers['idempotency-key'];
    if (!key || typeof key !== 'string' || key.length < 16 || key.length > 64) {
      throw new BadRequestException('Idempotency-Key header مطلوب (16-64 حرف)');
    }
    return key;
  },
);

// payments.controller.ts
@Post()
@Roles('SUPER_ADMIN', 'ACCOUNTANT')
create(
  @CurrentUser() user: JwtPayload,
  @Body() dto: CreatePaymentDto,
  @IdempotencyKey() idempotencyKey: string,
  @Req() req: Request,
) {
  return this.paymentsService.create(user, dto, idempotencyKey, req);
}

// payments.service.ts
async create(user: JwtPayload, dto: CreatePaymentDto, idempotencyKey: string, req: Request) {
  // check cache (Redis) for { companyId, userId, idempotencyKey }
  const cached = await this.idempotencyService.get(user.companyId, idempotencyKey);
  if (cached) return cached;  // ارجع نفس الـ response من الأول

  const payment = await this.prisma.$transaction(async (tx) => { /* ... */ });

  await this.idempotencyService.set(user.companyId, idempotencyKey, payment, 24 * 3600);
  return payment;
}
```

**العمليات اللي لازم تكون idempotent:**
- `POST /payments`
- `POST /updates/:id/approve`
- `POST /updates/:id/force-cancel`
- `POST /companies/:id/invoices`
- أي endpoint بيحرك فلوس أو بيغيّر progress

### 9. ParseUUIDPipe على كل param

✅ صح:
```typescript
@Get(':id')
findOne(@Param('id', ParseUUIDPipe) id: string) { /* ... */ }
```

❌ غلط:
```typescript
@Get(':id')
findOne(@Param('id') id: string) { /* ... */ }  // ⛔ ممكن يبعت "1; DROP TABLE..."
```

### 10. Pagination إجباري على كل list endpoint

✅ صح — استخدم `PaginationDto` من `common/dto`:
```typescript
async findAll(user: JwtPayload, query: ListProjectsQueryDto) {
  const { page = 1, limit = 20 } = query;
  if (limit > 100) throw new BadRequestException('الحد الأقصى 100 سجل لكل صفحة');
  // ...
}
```

❌ غلط:
```typescript
async findAll() {
  return this.prisma.project.findMany();  // ⛔ لو في 10,000 مشروع، الـ API هيقع
}
```

---

## Checklist قبل ما تـ merge أي endpoint

- [ ] DTO فيه validators على كل field
- [ ] `@Roles()` decorator موجود ومحدد
- [ ] Ownership check جوّا الـ service (companyId + role-based)
- [ ] الـ service بيستخدم `prisma.softDeleteFilter`
- [ ] Logger.log للنجاح + Logger.error للفشل مع context
- [ ] لا يوجد `error.message` متسرّب للـ client
- [ ] لو write operation: `$transaction` + AuditLog
- [ ] لو financial: Idempotency-Key مطلوب
- [ ] لو list: pagination + max limit
- [ ] Params: `ParseUUIDPipe`
- [ ] الـ test الأمني: جرّب نفس الـ endpoint بـ JWT من شركة تانية — لازم يرجع NotFound

---

## أسئلة لازم تجاوب عليها قبل ما تكتب أي endpoint

1. **لو حد بنية سيئة** يبعت 1000 request في الثانية على ده، إيه اللي هيحصل؟
2. **لو client من شركة A** بعت request بـ ID من شركة B، هيشوف بياناتهم؟
3. **لو الـ JWT expired** أثناء transaction، البيانات هتبقى consistent؟
4. **لو في bug في الـ service**، هل عندنا audit log نقدر نرجع منه؟
5. **لو راح للمحكمة**، تقدر تثبت مين عمل الـ action ده وامتى؟
