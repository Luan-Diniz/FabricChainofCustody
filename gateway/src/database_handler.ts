import { MongoClient, ObjectId } from 'mongodb';
import { randomUUID } from 'crypto';

// URI de Conexão
const uri = 'mongodb://root:password@localhost:27017/?authSource=admin';

// Cria um novo MongoClient
const client = new MongoClient(uri);

/**
 * Interface para o registro de uma credencial de custódia no MongoDB.
 * Este schema armazena o JWT da credencial e metadados para busca e vinculação.
 */
interface CustodyCredentialRecord {
    _id?: ObjectId;
    evidencehash: string;
    credentialId: string;
    vcJwt: string;
    previousCredentialId: string | null;
    sequence: number;
    status: 'active' | 'revoked' | 'analyzed';
    issuerDid: string;
    createdAt: Date;
    tags: string[];
}

export async function run() {
    try {
        // Conecta o cliente ao servidor
        await client.connect();
        console.log('Conectado com sucesso ao MongoDB');

        const database = client.db('chain_of_custody_db');
        const records = database.collection<CustodyCredentialRecord>('evidence_records');

        // --- 1. CREATE: Cria um novo registro de credencial de custódia ---
        console.log('\n--- CREATE ---');
        const newRecord: CustodyCredentialRecord = {
            evidencehash: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
            credentialId: `urn:uuid:${randomUUID()}`,
            // Exemplo de um JWT (JSON Web Token) que conteria a Verifiable Credential
            vcJwt: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSJdLCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiRXZpZGVuY2UiXSwiY3JlZGVudGlhbFN1YmplY3QiOnsic3RhdHVzIjoiYWN0aXZlIiwicHJldmlvdXNfY3JlZGVudGlhbF9pZCI6bnVsbH19fQ.signature_placeholder",
            previousCredentialId: null,
            sequence: 1,
            status: "active",
            issuerDid: "did:key:z6MkjdEnsDwsVCpnRBgQDwwRe3LYMJ89tvgSLae3qkYuJc5x",
            createdAt: new Date(),
            tags: ["coleta", "hd_externo", "caso_157-2025"]
        };

        const createResult = await records.insertOne(newRecord);
        console.log(`Novo registro de custódia criado com o seguinte id: ${createResult.insertedId}`);

        // --- 2. READ: Lê o registro recém-criado ---
        console.log('\n--- READ ---');
        const foundRecord = await records.findOne({ _id: createResult.insertedId });
        if (foundRecord) {
            console.log('Registro encontrado:');
            // Nota: O JWT é uma string longa, então o output pode ser grande.
            console.log(JSON.stringify(foundRecord, null, 2));
        } else {
            console.log('Registro não encontrado.');
        }

        // --- 3. UPDATE: Atualiza o status do registro e adiciona uma tag ---
        console.log('\n--- UPDATE ---');
        const updateResult = await records.updateOne(
            { _id: createResult.insertedId },
            { 
                $set: { status: "analyzed" },
                $push: { tags: "analise_concluida" }
            }
        );
        console.log(`${updateResult.modifiedCount} documento(s) foi/foram atualizado(s).`);
        
        const updatedRecord = await records.findOne({ _id: createResult.insertedId });
        if (updatedRecord) {
            console.log('Registro atualizado:');
            console.log(JSON.stringify(updatedRecord, null, 2));
        }

        // --- 4. DELETE: Deleta o registro ---
        console.log('\n--- DELETE ---');
        const deleteResult = await records.deleteOne({ _id: createResult.insertedId });
        console.log(`${deleteResult.deletedCount} documento(s) foi/foram deletado(s).`);
        
        const deletedRecord = await records.findOne({ _id: createResult.insertedId });
        console.log(deletedRecord ? 'Falha na deleção.' : 'Registro deletado com sucesso.');

    } finally {
        // Garante que o cliente fechará ao finalizar ou ocorrer um erro
        await client.close();
        console.log('\nConexão com o MongoDB fechada.');
    }
}
