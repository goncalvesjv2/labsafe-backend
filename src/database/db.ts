import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
})

export async function connect() {
    const client = await pool.connect();
    console.log("PostgreSQL Conectado");
    return client;
}