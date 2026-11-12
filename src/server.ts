import "dotenv/config";
import { app } from "./app"

app.listen({ port: Number(process.env.PORT) }, () => {
    console.log(`Servidor rodando na porta ${process.env.PORT}`)
})