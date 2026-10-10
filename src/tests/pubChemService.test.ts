import { describe, expect, test, jest, beforeEach, afterEach } from "@jest/globals";
import { pubChemService } from "../services/pubChemService";

describe("pubChemService", () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    })

    test("deve consultar um composto com sucesso", async () => {
        const response = {
            PropertyTable: {
                Properties: [{
                    CID: 962,
                    Title: "Water",
                    MolecularFormula: "H2O",
                    MolecularWeight: 18.015,
                }],
            }
        };

        jest.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            json: async () => response,
        } as Response);

        const result = await pubChemService("Water");

        expect(result).toEqual({
            cid: 962,
            title: "Water",
            molecularFormula: "H2O",
            molecularWeight: 18.015,
        });

        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        expect(globalThis.fetch).toHaveBeenCalledWith("https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/Water/property/Title,MolecularFormula,MolecularWeight/JSON");
    });

    test("deve lançar erro quando a API da falha", async () => {
        jest.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: false,
            json: async () => ({}),
        } as Response);

        await expect(pubChemService("ajifajfiapwkf")).rejects.toThrow("Composto não encontrado no PubChem");
    })
});