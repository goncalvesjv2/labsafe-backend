import "dotenv/config";
import { app } from "./app"

app.listen({ port: Number(process.env.PORT) || 3000, host: "0.0.0.0" }, (error, address) => {
    if (error) {
        console.error("Erro ao iniciar o servidor:", error);
        process.exit(1);
    }
    console.log(`Servidor rodando em ${address}`);
});