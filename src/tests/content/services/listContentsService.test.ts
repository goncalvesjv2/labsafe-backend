import { listContentsMock, savedContent } from "./helpers/contentServiceSetup";
import { describe, test, expect } from "@jest/globals";
import { listContentsService } from "../../../services/contentService";

describe("listContentsService", () => {
    test("deve retornar os conteúdos cadastrados", async () => {
        const otherContent = { ...savedContent, id: 2, teacherId: 20 };
        listContentsMock.mockResolvedValue([savedContent, otherContent]);
        const result = await listContentsService();
        expect(result).toEqual([savedContent, otherContent]);
        expect(listContentsMock).toHaveBeenCalledTimes(1);
    });

    test("deve retornar uma lista vazia quando não existem conteúdos", async () => {
        listContentsMock.mockResolvedValue([]);
        await expect(listContentsService()).resolves.toEqual([]);
    });

    test("deve retornar erro quando a consulta falhar", async () => {
        const error = new Error("Falha ao consultar conteúdos");
        listContentsMock.mockRejectedValue(error);
        await expect(listContentsService()).rejects.toBe(error);
    });
});
