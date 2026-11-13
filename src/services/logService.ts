import { ILog } from "../interfaces/ILog";
import { createLogRepository } from "../repositories/logRepository";
import type { Prisma } from "../generated/prisma/client";

export async function createLogService(log: ILog, transaction?: Prisma.TransactionClient) {
    const createLog = await createLogRepository(log, transaction);
    
    if(!createLog) {
        throw new Error("Log não foi registrado");
    }

    return createLog;
}
