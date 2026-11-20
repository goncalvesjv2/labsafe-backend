import { prisma } from "../database/prisma";
import { ILog } from "../interfaces/ILog";
import type { Prisma } from "../generated/prisma/client";

export async function listLogsRepository(): Promise<(ILog & { email: string })[]> {
    const logs = await prisma.logs.findMany({
        include: {
            usuario: {
                select: { email: true }
            }
        },
        orderBy: [{ created_at: "desc" }, { id: "desc" }]
    });

    return logs.map((log) => ({
        id: log.id,
        userId: log.user_id,
        email: log.usuario.email,
        action: log.action,
        description: log.description,
        createdAt: log.created_at
    }));
}

export async function createLogRepository(log: ILog, transaction: Prisma.TransactionClient = prisma) {
    return transaction.logs.create({
        data: {
            user_id: log.userId,
            action: log.action,
            description: log.description
        }
    });
}
