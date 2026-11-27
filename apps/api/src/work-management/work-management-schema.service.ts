import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Idempotent ADD-only schema fixes for work management (VPS thường chạy migrate chậm hơn code).
 */
@Injectable()
export class WorkManagementSchemaService implements OnModuleInit {
  private readonly logger = new Logger(WorkManagementSchemaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.ensureWorkManagementColumns();
    } catch (err) {
      this.logger.warn(`ensureWorkManagementColumns skipped: ${String(err)}`);
    }
  }

  async ensureWorkManagementColumns() {
    await this.prisma.$executeRawUnsafe(`
      ALTER TABLE "work_projects"
        ADD COLUMN IF NOT EXISTS "custom_field_defs" JSONB DEFAULT '[]'::jsonb;
    `);
    await this.prisma.$executeRawUnsafe(`
      ALTER TABLE "work_tasks"
        ADD COLUMN IF NOT EXISTS "custom_fields" JSONB DEFAULT '{}'::jsonb;
    `);
    await this.prisma.$executeRawUnsafe(`
      ALTER TABLE "work_checklist_items"
        ADD COLUMN IF NOT EXISTS "assignee_id" TEXT,
        ADD COLUMN IF NOT EXISTS "start_date" DATE,
        ADD COLUMN IF NOT EXISTS "due_date" DATE;
    `);
    await this.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "work_checklist_items_assignee_id_idx"
        ON "work_checklist_items"("assignee_id");
    `);
    this.logger.log(
      'Work management schema columns OK (custom_field_defs / custom_fields / checklist assignee+dates)',
    );
  }
}
