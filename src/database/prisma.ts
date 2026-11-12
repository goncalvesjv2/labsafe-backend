import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("A variável de ambiente do banco de dados não foi definida")
}

const adapter = new PrismaPg({connectionString});
export const prisma = new PrismaClient({adapter});