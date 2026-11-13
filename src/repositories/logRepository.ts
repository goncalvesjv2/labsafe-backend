import { prisma } from "../database/prisma";
import { ILog } from "../interfaces/ILog";
import type { Prisma } from "../generated/prisma/client";

export async function createLogRepository(log: ILog, transaction: Prisma.TransactionClient = prisma) {
    return transaction.logs.create({
        data: {
            user_id: log.userId,
            action: log.action,
            description: log.description
        }
    });
}
