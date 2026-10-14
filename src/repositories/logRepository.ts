import { prisma } from "../database/prisma";
import { ILog } from "../interfaces/ILog";

export async function createLogRepository(log: ILog) {
    return prisma.logs.create({
        data: {
            user_id: log.userId,
            action: log.action,
            description: log.description
        }
    });
}