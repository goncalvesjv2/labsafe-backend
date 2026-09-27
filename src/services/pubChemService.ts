import { IPubChem } from "../interfaces/IPubChem";

export async function pubChemService(name: string) {
    const encodeName = encodeURIComponent(name);
    const response = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeName}/property/Title,MolecularFormula,MolecularWeight/JSON`)
    
    if (!response.ok) {
        throw new Error("Composto não encontrado no PubChem");
    }

    const data = await response.json() as {
        PropertyTable: {
            Properties: IPubChem[];
        };
    };
    
    const compound = data.PropertyTable.Properties[0];
    
    return {
        cid: compound.CID,
        title: compound.Title,
        molecularFormula: compound.MolecularFormula,
        molecularWeight: compound.MolecularWeight
    };
}