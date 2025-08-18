import { Contract } from '@hyperledger/fabric-gateway';
import { TextDecoder } from 'util';
import { createHash } from 'crypto';
import { createGatewayConnection, channelName, chaincodeName } from './connect';
//import { runVcDemo } from './vc-handler';
import { createIssuer, createCredentialId} from './util';
import { createCredential, CredentialSubjectData } from './vc-handler';
import type { Issuer } from 'did-jwt-vc' with { 'resolution-mode': 'import' };;
//import type { DIDDocument } from 'did-resolver' with { 'resolution-mode': 'import' };;

import { DatabaseHandler, CustodyCredentialRecord } from './database-handler';
//import { runVcDemo } from './vc-demo';
//import { run } from './database_handler';

const utf8Decoder = new TextDecoder();
//const assetId = `asset${String(Date.now())}`;

async function main(): Promise<void> {

    // Establish the connection with the gateway and retrieve client and gateway objects.
    const { gateway, client } = await createGatewayConnection();

    const OWNER_DID = 'did:example:owner';
    const OWNER2_DID = 'did:example:owner2';
    const uri = 'mongodb://root:password@localhost:27017/?authSource=admin';
    const dbHandler = new DatabaseHandler(uri);

    const {issuer} = await createIssuer();

    const credentialId = await createCredentialId();


    const my_subject = {
            id: credentialId,
            evidence_hash: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
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
        console.log(await dbHandler.findRecordByCredentialId(credentialId));

        await transfer_evidence_ownership(credentialId, OWNER2_DID, dbHandler, contract);
        await readAssetByID(contract, credentialId);

        console.log(await dbHandler.findRecordByCredentialId(credentialId));
        
        // Creating another credential for testing update.
        const newcredentialId = await createCredentialId();
        const new_my_subject = {
            id: newcredentialId,
            evidence_hash: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
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
                    evidencehash: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
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
        await readAssetByID(contract, newcredentialId);
        console.log(await dbHandler.findRecordByCredentialId(newcredentialId));
        
        
        
        
        
        
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

// async function get_chain_of_custody




/**
 * Initialize ledger with dummy data from chaincode's InitLedger
async function initLedger(contract: Contract): Promise<void> {
    console.log('\n--> Submit Transaction: InitLedger, creates initial credentials');
    
    await contract.submitTransaction('InitLedger');
    
    console.log('*** Transaction successfully committed');
}
*/

/**
 * Query all assets
async function getAllAssets(contract: Contract): Promise<void> {
    console.log('\n--> Evaluate Transaction: GetAllAssets, returns all credentials');
    
    const resultBytes = await contract.evaluateTransaction('GetAllAssets');
    
    const resultJson = utf8Decoder.decode(resultBytes);
    const result: unknown = JSON.parse(resultJson);
    console.log('*** Result:', result);
}
*/

/**
 * Create a new credential with dummy but valid parameters
 * assetID is the credential ID (did)
 */
async function createAsset(contract: Contract, assetID: string, owner_did: string, issuer_did: string, credential_hash: string): Promise<void> {
    console.log('\n--> Submit Transaction: CreateAsset, creates a new credential');

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

    console.log(`*** Credential ${assetID} successfully created`);
}

/**
 * Read a credential by ID
*/
async function readAssetByID(contract: Contract, assetId: string): Promise<void> {
    console.log('\n--> Evaluate Transaction: ReadAsset, returns credential attributes');
    
    const resultBytes = await contract.evaluateTransaction('ReadAsset', assetId);
    
    const resultJson = utf8Decoder.decode(resultBytes);
    const result: unknown = JSON.parse(resultJson);
    console.log('*** Result:', result);
}

/**
 * TransferOwnership
*/
async function transferOwnership(contract: Contract, assetId: string, newOwnerDid: string): Promise<void> {
    console.log('\n--> Submit Transaction: transferOwnership');
    
    await contract.submitTransaction('TransferOwnership', assetId, newOwnerDid);
    
    console.log(`*** Credential ${assetId} owner changed to ${newOwnerDid}`);
}

/**
 * Revoke an existing credential
*/
async function revokeAsset(contract: Contract, assetId: string): Promise<void> {
    console.log('\n--> Submit Transaction: RevokeAsset, changes status to revoked');
    
    await contract.submitTransaction('RevokeAsset', assetId);
    
    console.log(`*** Credential ${assetId} successfully revoked`);
}


/**
 * Update an existing credential with dummy values
async function updateAsset(contract: Contract): Promise<void> {
    console.log('\n--> Submit Transaction: UpdateAsset, updates an existing credential');
    
    const assetId = 'cred-dummy';
    const status = 'revoked';
    const issuerDID = 'did:example:issuer-updated';
    const timestamp = new Date().toISOString();
    
    await contract.submitTransaction(
        'UpdateAsset',
        assetId,
        status,
        issuerDID,
        timestamp
    );
    
    console.log(`*** Credential ${assetId} successfully updated`);
}
*/

/**
 * Test updating a non-existent credential — should throw an error
async function updateNonExistentAsset(contract: Contract): Promise<void> {
    console.log('\n--> Submit Transaction: UpdateAsset on non-existent credential');
    
    try {
        await contract.submitTransaction(
            'UpdateAsset',
            'nonexistent-cred',
            'active',
            'did:example:issuer-fake',
            new Date().toISOString()
        );
        console.log('******** FAILED to return an error');
    } catch (error) {
        console.log('*** Caught expected error: \n', error);
    }
}
*/