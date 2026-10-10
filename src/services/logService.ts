import { ILog } from "../interfaces/ILog";
import { createLogRepository } from "../repositories/logRepository";

export async function createLogService(log: ILog) {
    const createLog = await createLogRepository(log);
    
    if(!createLog) {
        throw new Error("Log não foi registrado");
    }

    return createLog;
}