import { listContentByIdMock, savedContent } from "./helpers/contentServiceSetup";
import { describe, test, expect } from "@jest/globals";
import { listContentByIdService } from "../../../services/contentService";

describe("listContentByIdService", () => {
    test("deve retornar o conteúdo encontrado pelo ID", async () => {
        const result = await listContentByIdService(savedContent.id);
        expect(result).toEqual(savedContent);
        expect(listContentByIdMock).toHaveBeenCalledTimes(1);
        expect(listContentByIdMock).toHaveBeenCalledWith(savedContent.id);
    });

    test("deve informar quando o conteúdo não existe", async () => {
        listContentByIdMock.mockResolvedValue(null);
        await expect(listContentByIdService(999)).rejects.toThrow("Conteúdo não encontrado");
    });

    test("deve retornar erro quando a consulta falhar", async () => {
        const error = new Error("Falha ao consultar conteúdo");
        listContentByIdMock.mockRejectedValue(error);
        await expect(listContentByIdService(savedContent.id)).rejects.toBe(error);
    });
});
