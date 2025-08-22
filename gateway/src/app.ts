import { Contract } from '@hyperledger/fabric-gateway';
import { TextDecoder } from 'util';
import { createHash } from 'crypto';
import { createGatewayConnection, channelName, chaincodeName } from './connect';
import { createIssuer, createCredentialId} from './util';
import { createCredential, CredentialSubjectData, verifyCreatedCredential } from './vc-handler';
import type { Issuer, VerifiedCredential } from 'did-jwt-vc' with { 'resolution-mode': 'import' };

import { DatabaseHandler, CustodyCredentialRecord } from './database-handler';
//simport { log } from 'console';

const utf8Decoder = new TextDecoder();

async function main(): Promise<void> {

    // Establish the connection with the gateway and retrieve client and gateway objects.
    const { gateway, client } = await createGatewayConnection();

    const EVIDENCE_HASH = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';
    const OWNER_DID = 'did:example:owner';
    const OWNER2_DID = 'did:example:owner2';
    const uri = 'mongodb://root:password@localhost:27017/?authSource=admin';
    const dbHandler = new DatabaseHandler(uri);

    const {issuer} = await createIssuer();

    const credentialId = await createCredentialId();


    const my_subject = {
            id: credentialId,
            evidence_hash: EVIDENCE_HASH,
            previous_credential_id: null,
            evidence_record: {
                what: "Um HD externo da marca Seagate, modelo Expansion, capacidade de 2TB, S/N: NA8K9J7H, cor preta. O dispositivo foi encontrado conectado a um desktop.",
                who: "Coletado pelo Perito Policial Tiago Bastos (ID Funcional 9845-B), na presença das testemunhas arroladas no Termo de Apreensão.",
                where: "No escritório de um apartamento residencial localizado na Rua Lauro Linhares, 1200, Apto 501, Trindade, Florianópolis - SC.",
                when: "Apreendido no dia 15 de agosto de 2025, exatamente às 15:47 (horário de Brasília), durante o cumprimento de um mandado de busca e apreensão.",
                why: "Para ser submetido à análise forense digital, pois há suspeita de que armazene planilhas de contabilidade e documentos relacionados a uma investigação de lavagem de dinheiro.",
                how: "O dispositivo foi desconectado de forma segura do computador, fotografado, acondicionado em embalagem antiestática e lacrado com o lacre de segurança número SP-SC-08152025-007. Todo o processo foi documentado no formulário de cadeia de custódia."
            }
        };

    const RecordData: Omit<CustodyCredentialRecord, '_id'> = {
                evidencehash: "",    // Will be copied from the credential.
                credentialId: credentialId,
                vcJwt: "",
                previousCredentialId: null,
                last_modifier_did: "",
                sequence: null,
                status: "active",
                issuerDid: issuer.did,
                ownerDid: OWNER_DID,
                createdAt: new Date(),
                tags: ["coleta", "hd_externo", "caso_157-2025"]
    };

    await dbHandler.connect();

    try {
        // Get a network instance representing the channel where the smart contract is deployed.
        const network = gateway.getNetwork(channelName);

        // Retrieve the smart contract from the network.
        const contract = network.getContract(chaincodeName);

        // *************** DEMO ***********************
        await create_evidence(my_subject, issuer,  dbHandler, RecordData, contract);
        await readAssetByID(contract, credentialId);
        //console.log(await dbHandler.findRecordByCredentialId(credentialId));

        await transfer_evidence_ownership(credentialId, OWNER2_DID, dbHandler, contract);
        await readAssetByID(contract, credentialId);

        //console.log(await dbHandler.findRecordByCredentialId(credentialId));
        
        // Creating another credential for testing update.
        const newcredentialId = await createCredentialId();
        const new_my_subject = {
            id: newcredentialId,
            evidence_hash: EVIDENCE_HASH,
            previous_credential_id: null,
            evidence_record: {
                what: "Novo what.",
                who: "Novo who.",
                where: "Novo where.",
                when: "Novo when.",
                why: "Novo why.",
                how: "Novo how."
            }
        };
        const newRecordData: Omit<CustodyCredentialRecord, '_id'> = {
                    evidencehash: EVIDENCE_HASH,
                    credentialId: newcredentialId,
                    vcJwt: "",
                    previousCredentialId: null,
                    last_modifier_did: "",
                    sequence: null,
                    status: "active",
                    issuerDid: issuer.did,
                    ownerDid: OWNER_DID,
                    createdAt: new Date(),
                    tags: ["coleta", "hd_externo", "caso_157-2025"]
        };
        const old_credential_did = credentialId;
        await update_evidence(old_credential_did, new_my_subject, issuer, dbHandler, newRecordData, contract);

        const actual_credential_id = await await get_credential_id_by_evidence_hash(EVIDENCE_HASH ,dbHandler);
        if (actual_credential_id){
            const chain_of_custody = await get_chain_of_custody(actual_credential_id, dbHandler, contract);

            // ********************************* PRINT CHAIN OF CUSTODY ******************************************
            console.log("\n--- INÍCIO DA CADEIA DE CUSTÓDIA ---");
            // Itera sobre cada elo da cadeia
            chain_of_custody.forEach((link, index) => {
                console.log(`\n------------------ Elo ${index + 1} ------------------`);
                // Imprime o registro do banco de dados de forma legível
                console.log("\n[+] Registro do Banco de Dados:");
                console.log(JSON.stringify(link.databaseRecord, null, 2));
                // Imprime os dados do ledger de forma legível
                console.log("\n[+] Dados do Ledger (Blockchain):");
                console.log(JSON.stringify(link.ledgerData, null, 2));
            });
            console.log("\n------------------ FIM DA CADEIA ------------------\n");


            const payload = await verify_chain_of_custody(chain_of_custody);

            console.log("\n ----------------- PAYLOADS ------------------------")
            console.log(payload);
            console.log("\n ----------------- FIM DOS PAYLOADS ------------------------")
        }



        
       // console.log('*** Raw Result from Ledger:', await readAssetByID(contract, newcredentialId));
        //console.log(await dbHandler.findRecordByCredentialId(newcredentialId));
        
        //console.log(await get_credential_id_by_evidence_hash(EVIDENCE_HASH ,dbHandler));
        
        
        
        
    } finally {
        // Close the connection with the gateway and gRPC client.
        await dbHandler.disconnect();
        gateway.close();
        client.close();
    }

}

main().catch((error: unknown) => {
    console.error('******** FAILED to run the application:', error);
    process.exitCode = 1;
});



async function create_evidence(
                subject_data: CredentialSubjectData, issuer: Issuer,
                dbHandler: DatabaseHandler, RecordData: CustodyCredentialRecord, contract: Contract): Promise<string> {

        // Creates credential and store in database.
        const vcJwt = await createCredential(subject_data, issuer);
        RecordData.vcJwt = vcJwt;
        RecordData.last_modifier_did = RecordData.ownerDid;
        RecordData.sequence = 1;
        RecordData.evidencehash = subject_data.evidence_hash;
        // Ver se os dados estão sendo preenchidos corretamente!!


        await dbHandler.createRecord(RecordData);

        const credentialHash = createHash('sha256').update(vcJwt).digest('hex');
        // Stores some data in blockchain.
        await createAsset(contract, RecordData.credentialId, RecordData.ownerDid, RecordData.issuerDid, credentialHash);


        return RecordData.credentialId;
}

async function transfer_evidence_ownership(credential_id: string, new_owner_did: string, dbHandler: DatabaseHandler, contract: Contract): Promise<void> {
    //  Change owner --> in blockchain data and db data.
    // Muda o owner, mas não o "last_modifier_did" --> deveria estar na blockchain tbm?
    await dbHandler.updateRecordOwner(credential_id, new_owner_did);

    // blockchain operation
    await transferOwnership(contract, credential_id, new_owner_did);

}

async function update_evidence(old_credential_did: string,
                subject_data: CredentialSubjectData, issuer: Issuer,
                dbHandler: DatabaseHandler, newRecordData: CustodyCredentialRecord, contract: Contract): Promise<void> { 

                    // Need to calculate the sequence number!!!!

                    const credential_record = await dbHandler.findRecordByCredentialId(old_credential_did);
                    if (credential_record?.sequence) {
                        newRecordData.sequence = credential_record.sequence + 1;
                    }


                    // Create new credential.
                    const vcJwt = await createCredential(subject_data, issuer);
                    newRecordData.vcJwt = vcJwt;
                    newRecordData.evidencehash = subject_data.evidence_hash;
                    newRecordData.last_modifier_did = newRecordData.ownerDid;
                    newRecordData.previousCredentialId = old_credential_did;


                    await dbHandler.createRecord(newRecordData);

                    const credentialHash = createHash('sha256').update(vcJwt).digest('hex');
                    // Stores data of the new credential in blockchain.
                    await createAsset(contract, newRecordData.credentialId, newRecordData.ownerDid, newRecordData.issuerDid, credentialHash);

                    

                    // Change status of old credential in database

                    await dbHandler.updateRecordStatus(old_credential_did, "revoked");
                    
                    // Change status of old credential in blockchain.
                    await revokeAsset(contract, old_credential_did);
}




 async function verify_chain_of_custody(chain_of_custody: Array<{databaseRecord: CustodyCredentialRecord, ledgerData: Asset}>) 
    : Promise<Array<VerifiedCredential>> {
        // Use um laço for...of para iterar sobre a cadeia

    let payloads: Array<VerifiedCredential> = [];

    for (const [index, link] of chain_of_custody.entries()) {
        try {
            // 1. Verificar se o hash da credencial corresponde ao que está no ledger
            const calculatedHash = createHash('sha256').update(link.databaseRecord.vcJwt).digest('hex');

            if (link.ledgerData.credential_id !== link.databaseRecord.credentialId) {
                throw new Error(`Credentials id do not match at index ${index}.`);
            }

            if (calculatedHash !== link.ledgerData.credential_hash) {
                // Lança um erro específico se o hash não corresponder
                throw new Error(`Hash mismatch for credential at index ${index}.`);
            }

            // 2. Verificar a autenticidade e integridade da credencial JWT
            // 'await' aqui irá pausar o laço, como esperado.
            const verified_credential = await verifyCreatedCredential(link.databaseRecord.vcJwt);
            payloads.push(verified_credential);
            

        } catch (error: any) {
            // Captura erros tanto da verificação de hash quanto da verificação da credencial
            console.error(`Failed to verify credential ${index} in the chain of custody:`, error.message);
            // Propaga o erro para interromper a verificação da cadeia
            throw error; 
        }
    }

    return payloads;

 }




 
/**
 * Retrieves the entire chain of custody for a given credential ID.
 * It traverses the credential history by recursively looking up the previous credential ID.
 * @param {string} credential_id The starting credential ID.
 * @param {DatabaseHandler} dbHandler An instance of the database handler to fetch credential records.
 * @param {Contract} contract The contract instance to interact with the ledger.
 * @returns {Promise<Array<{databaseRecord: CustodyCredentialRecord, ledgerData: Asset}>>} A promise that resolves with a list of tuples, 
 * where each tuple contains the typed database record and the corresponding typed ledger data.
 */
async function get_chain_of_custody(credential_id: string, dbHandler: DatabaseHandler, contract: Contract): Promise<Array<{databaseRecord: CustodyCredentialRecord, ledgerData: Asset}>> {
    // This list will store the combined data from the database and the ledger.
    const chainOfCustody: Array<{databaseRecord: CustodyCredentialRecord, ledgerData: Asset}> = [];
    
    // Start with the initial credential ID provided.
    let current_cred_id: string | null = credential_id;
    
    do {
        // Fetch the record from your local database.
        const cred_record = await dbHandler.findRecordByCredentialId(current_cred_id) as CustodyCredentialRecord;
        
        // Fetch the corresponding asset data from the ledger, now strongly typed.
        const ledger_data = await readAssetByID(contract, current_cred_id);
        
        // Store the combined results as an object in our list.
        chainOfCustody.push({ 
            databaseRecord: cred_record, 
            ledgerData: ledger_data 
        });
        
        // Check if a previous credential exists to continue the chain.
        if (cred_record && cred_record.previousCredentialId) {
            current_cred_id = cred_record.previousCredentialId;
        } else if (cred_record) {
            // If there's a record but no previous ID, the chain ends here.
            current_cred_id = null;
        } 
        else {
            // If no record is found at all, the chain is broken.
            throw new Error(`The chain of custody is broken. Could not find a record for credential ID: ${current_cred_id}`);
        }
    
    } while (current_cred_id);

    // Return the complete list of records.
    return chainOfCustody;
}




    
    




async function get_credential_id_by_evidence_hash(evidence_hash: string, dbHandler: DatabaseHandler) : Promise<string | null> {
    const credential_id = await dbHandler.findActiveCredentialByEvidenceHash(evidence_hash);
    
    return credential_id;
}





/**
 * Create a new credential with dummy but valid parameters
 * assetID is the credential ID (did)
 */
async function createAsset(contract: Contract, assetID: string, owner_did: string, issuer_did: string, credential_hash: string): Promise<void> {
    //console.log('\n--> Submit Transaction: CreateAsset, creates a new credential');

    const status = 'active';
    const timestamp = new Date().toISOString();

    await contract.submitTransaction(
        'CreateAsset',
        assetID,
        status,
        issuer_did,
        owner_did,
        credential_hash,
        timestamp,
    );

    //console.log(`*** Credential ${assetID} successfully created`);
}


interface Asset {
    status: string;
    timestamp: string;
    owner_did: string;
    issuer_did: string;
    credential_id: string;
    credential_hash: string;
    last_modifier_did: string;
}
/**
 * Reads a credential by its ID from the ledger and returns it as a typed Asset object.
 * @param {Contract} contract The contract instance.
 * @param {string} assetId The ID of the asset to read.
 * @returns {Promise<Asset>} A promise that resolves with the typed asset object.
 */
async function readAssetByID(contract: Contract, assetId: string): Promise<Asset> {

    // console.log(`\n--> Evaluate Transaction: ReadAsset for ID: ${assetId}`);
    
    
    const resultBytes = await contract.evaluateTransaction('ReadAsset', assetId);
    
    const resultJson = utf8Decoder.decode(resultBytes);
    // We cast the parsed JSON to our Asset interface to get type safety.
    const result = JSON.parse(resultJson) as Asset;
    

    //console.log('*** Typed Result:', result);
    

    return result;
}

/**
 * TransferOwnership
*/
async function transferOwnership(contract: Contract, assetId: string, newOwnerDid: string): Promise<void> {
    //console.log('\n--> Submit Transaction: transferOwnership');
    
    await contract.submitTransaction('TransferOwnership', assetId, newOwnerDid);
    
    //console.log(`*** Credential ${assetId} owner changed to ${newOwnerDid}`);
}

/**
 * Revoke an existing credential
*/
async function revokeAsset(contract: Contract, assetId: string): Promise<void> {
    //console.log('\n--> Submit Transaction: RevokeAsset, changes status to revoked');
    
    await contract.submitTransaction('RevokeAsset', assetId);
    
    //console.log(`*** Credential ${assetId} successfully revoked`);
}
