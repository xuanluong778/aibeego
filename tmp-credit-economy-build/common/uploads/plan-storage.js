"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writePlanFile = writePlanFile;
const database_1 = require("@marketingspa/database");
const promises_1 = require("node:fs/promises");
/** Only server-generated destination paths may be passed here. Never accepts a client path. */
async function writePlanFile(db, organizationId, destination, expectedBytes, write) {
    return db.$transaction(async (tx) => {
        await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`plan-storage:${organizationId}`}))`;
        const { definition } = await (0, database_1.organizationPlan)(tx, organizationId);
        if (!definition)
            return write();
        const maxFile = definition.limits.uploadMb * 1024 * 1024;
        const maxStorage = definition.limits.storageMb * 1024 * 1024;
        const files = await tx.planStoredFile.findMany({ where: { organizationId } });
        let used = 0;
        // Physical deletion releases quota on the next upload, including expired video workdirs.
        for (const file of files) {
            try {
                used += (await (0, promises_1.stat)(file.path)).size;
            }
            catch (error) {
                if (error.code !== 'ENOENT')
                    throw error;
                await tx.planStoredFile.delete({ where: { id: file.id } });
            }
        }
        const reject = (bytes) => {
            if (bytes > maxFile || used + bytes > maxStorage)
                throw new database_1.PlanPolicyError('PLAN_LIMIT_REACHED', bytes > maxFile
                    ? 'Tệp vượt dung lượng cho phép của gói.'
                    : 'Đã hết dung lượng lưu trữ của gói.', {
                    resource: bytes > maxFile ? 'uploadMb' : 'storageMb',
                    limit: bytes > maxFile ? maxFile : maxStorage,
                    used,
                });
        };
        reject(expectedBytes);
        try {
            const result = await write();
            const bytes = (await (0, promises_1.stat)(destination)).size;
            reject(bytes);
            await tx.planStoredFile.create({
                data: { organizationId, path: destination, sizeBytes: BigInt(bytes) },
            });
            return result;
        }
        catch (error) {
            await (0, promises_1.unlink)(destination).catch(() => undefined);
            throw error;
        }
    }, { timeout: 30000 });
}
