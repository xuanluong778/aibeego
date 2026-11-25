import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import type { AdminUpdateCreditCostDto } from './dto/admin-credit-cost.dto';

@Injectable()
export class CreditCostsAdminService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list() {
    const since = new Date(Date.now() - 30 * 86400000);
    const [rows, usage] = await Promise.all([
      this.prisma.creditFeaturePricing.findMany({ orderBy: [{ sortOrder: 'asc' }, { featureCode: 'asc' }] }),
      this.prisma.creditTransaction.groupBy({ by: ['featureCode'],
        where: { type: 'USAGE', createdAt: { gte: since }, featureCode: { not: null } },
        _sum: { amount: true }, _count: { _all: true },
      }),
    ]);
    const totals = new Map(usage.map(row => [row.featureCode, row]));
    return rows.map(row => {
      const [module, ...action] = row.featureCode.split('.');
      return { id: row.id, featureCode: row.featureCode, module, action: action.join('.'),
        name: row.name, description: row.description, creditCost: Number(row.creditCost),
        isActive: row.isActive, reserved: ['content_ai.image', 'assistant.write'].includes(row.featureCode), updatedAt: row.updatedAt,
        unit: row.featureCode === 'content_ai.image' ? 'ảnh'
          : row.featureCode === 'content_ai.generate' ? 'content tạo thành công'
          : row.featureCode === 'content_ai.suggest' ? 'miễn phí'
          : row.featureCode === 'video.transcribe' ? 'phút âm thanh'
          : row.featureCode === 'email.send' ? 'email / người nhận' : 'lượt AI cơ bản',
        usedCredits30d: Number(totals.get(row.featureCode)?._sum.amount || 0),
        chargedCalls30d: totals.get(row.featureCode)?._count._all || 0,
      };
    });
  }

  async update(user: AuthUser, featureCode: string, dto: AdminUpdateCreditCostDto, ip?: string) {
    if (user.role !== 'SUPER_ADMIN') throw new ForbiddenException('Platform admin required');
    if (featureCode === 'content_ai.suggest') throw new BadRequestException('Gợi ý trong phần Content miễn phí, chỉ tính credit khi tạo content thành công.');
    return this.prisma.$transaction(async tx => {
      const before = await tx.creditFeaturePricing.findUnique({ where: { featureCode } });
      if (!before) throw new NotFoundException('Không tìm thấy tác vụ tính credit');
      if (before.updatedAt.getTime() !== new Date(dto.expectedUpdatedAt).getTime())
        throw new ConflictException('Mức credit đã được thay đổi ở phiên khác. Hãy làm mới trước khi lưu.');
      if (Number(before.creditCost) === dto.creditCost) return { featureCode, creditCost: dto.creditCost, updatedAt: before.updatedAt };
      const changed = await tx.creditFeaturePricing.updateMany({
        where: { id: before.id, updatedAt: new Date(dto.expectedUpdatedAt) }, data: { creditCost: dto.creditCost },
      });
      if (!changed.count) throw new ConflictException('Mức credit vừa thay đổi. Hãy làm mới trước khi lưu.');
      const after = await tx.creditFeaturePricing.findUniqueOrThrow({ where: { id: before.id } });
      await this.audit.log({ organizationId: user.organizationId, userId: user.id,
        action: 'PLATFORM_CREDIT_COST_UPDATED', entityType: 'CreditFeaturePricing', entityId: before.id,
        metadata: { featureCode, before: Number(before.creditCost), after: dto.creditCost }, ipAddress: ip,
      }, tx);
      return { featureCode, creditCost: Number(after.creditCost), updatedAt: after.updatedAt };
    });
  }
}
