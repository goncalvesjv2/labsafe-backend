import { connect } from "../database/db";
import { ILog } from "../interfaces/ILog";

export async function createLogRepository(log: ILog) {
    const client = await connect();

    try {
        const sql = "INSERT INTO logs (user_id, action, description) VALUES ($1, $2, $3) RETURNING *";
        const values = [log.userId, log.action, log.description];
        const res = await client.query(sql, values);
        return res.rows[0];
    } catch (error) {
        console.error("Erro ao criar log: ", error);
        throw error;
    } finally {
        client.release();
    }
}