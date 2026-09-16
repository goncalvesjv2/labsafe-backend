import "dotenv/config";
import { app } from "./app"

app.listen({ port: Number(process.env.port) }, () => {
    console.log(`Servidor rodando na porta ${process.env.PORT}`)
})