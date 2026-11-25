import { PlanPolicyError, organizationPlan, type PrismaClient } from '@marketingspa/database';
import { stat, unlink } from 'node:fs/promises';

/** Only server-generated destination paths may be passed here. Never accepts a client path. */
export async function writePlanFile<T>(
  db: PrismaClient,
  organizationId: string,
  destination: string,
  expectedBytes: number,
  write: () => Promise<T>,
): Promise<T> {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`plan-storage:${organizationId}`}))`;
      const { definition } = await organizationPlan(tx, organizationId);
      if (!definition) return write();
      const maxFile = definition.limits.uploadMb * 1024 * 1024;
      const maxStorage = definition.limits.storageMb * 1024 * 1024;
      const files = await tx.planStoredFile.findMany({ where: { organizationId } });
      let used = 0;
      // Physical deletion releases quota on the next upload, including expired video workdirs.
      for (const file of files) {
        try {
          used += (await stat(file.path)).size;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          await tx.planStoredFile.delete({ where: { id: file.id } });
        }
      }
      const reject = (bytes: number) => {
        if (bytes > maxFile || used + bytes > maxStorage)
          throw new PlanPolicyError(
            'PLAN_LIMIT_REACHED',
            bytes > maxFile
              ? 'Tệp vượt dung lượng cho phép của gói.'
              : 'Đã hết dung lượng lưu trữ của gói.',
            {
              resource: bytes > maxFile ? 'uploadMb' : 'storageMb',
              limit: bytes > maxFile ? maxFile : maxStorage,
              used,
            },
          );
      };
      reject(expectedBytes);
      try {
        const result = await write();
        const bytes = (await stat(destination)).size;
        reject(bytes);
        await tx.planStoredFile.create({
          data: { organizationId, path: destination, sizeBytes: BigInt(bytes) },
        });
        return result;
      } catch (error) {
        await unlink(destination).catch(() => undefined);
        throw error;
      }
    },
    { timeout: 30000 },
  );
}
