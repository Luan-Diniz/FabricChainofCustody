import { Contract } from '@hyperledger/fabric-gateway';
import { TextDecoder } from 'util';
import { createGatewayConnection, channelName, chaincodeName } from './connect';
//import { runVcDemo } from './vc-demo';
import { run } from './database_handler';

const utf8Decoder = new TextDecoder();
//const assetId = `asset${String(Date.now())}`;

async function main(): Promise<void> {

    await run().catch(console.dir);


    //await runVcDemo();
    
    process.exit();
    


        
    // Establish the connection with the gateway and retrieve client and gateway objects.
    const { gateway, client } = await createGatewayConnection();

    try {
        // Get a network instance representing the channel where the smart contract is deployed.
        const network = gateway.getNetwork(channelName);

        // Retrieve the smart contract from the network.
        const contract = network.getContract(chaincodeName);

        // Initialize a set of assets in the ledger using the chaincode function 'InitLedger'.
        await initLedger(contract);

        // Retrieve all current assets in the ledger.
        await getAllAssets(contract);

        // Create a new asset in the ledger.
        await createAsset(contract);

        // Updates the Asset
        await updateAsset(contract);



        // Update an existing asset asynchronously.
        //await transferAssetAsync(contract);

        // Retrieve asset details by assetID.
        await readAssetByID(contract);

        await revokeAsset(contract);

        // Attempt to update a non-existent asset. Must generate an error
        //await updateNonExistentAsset(contract) 

    } finally {
        // Close the connection with the gateway and gRPC client.
        gateway.close();
        client.close();
    }
}

main().catch((error: unknown) => {
    console.error('******** FAILED to run the application:', error);
    process.exitCode = 1;
});

/**
 * Initialize ledger with dummy data from chaincode's InitLedger
 */
async function initLedger(contract: Contract): Promise<void> {
    console.log('\n--> Submit Transaction: InitLedger, creates initial credentials');

    await contract.submitTransaction('InitLedger');

    console.log('*** Transaction successfully committed');
}

/**
 * Query all assets
 */
async function getAllAssets(contract: Contract): Promise<void> {
    console.log('\n--> Evaluate Transaction: GetAllAssets, returns all credentials');

    const resultBytes = await contract.evaluateTransaction('GetAllAssets');

    const resultJson = utf8Decoder.decode(resultBytes);
    const result: unknown = JSON.parse(resultJson);
    console.log('*** Result:', result);
}

/**
 * Create a new credential with dummy but valid parameters
 */
async function createAsset(contract: Contract): Promise<void> {
    console.log('\n--> Submit Transaction: CreateAsset, creates a new credential');

    const assetId = 'cred-dummy';
    const status = 'active';
    const issuerDID = 'did:example:issuer-dummy';
    const timestamp = new Date().toISOString();

    await contract.submitTransaction(
        'CreateAsset',
        assetId,
        status,
        issuerDID,
        timestamp
    );

    console.log(`*** Credential ${assetId} successfully created`);
}

/**
 * Read a credential by ID
 */
async function readAssetByID(contract: Contract): Promise<void> {
    console.log('\n--> Evaluate Transaction: ReadAsset, returns credential attributes');

    const assetId = 'cred-dummy'; // Use an existing credential ID
    const resultBytes = await contract.evaluateTransaction('ReadAsset', assetId);

    const resultJson = utf8Decoder.decode(resultBytes);
    const result: unknown = JSON.parse(resultJson);
    console.log('*** Result:', result);
}

/**
 * Update an existing credential with dummy values
 */
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

/**
 * Revoke an existing credential
 */
async function revokeAsset(contract: Contract): Promise<void> {
    console.log('\n--> Submit Transaction: RevokeAsset, changes status to revoked');

    const assetId = 'cred-dummy';

    await contract.submitTransaction('RevokeAsset', assetId);

    console.log(`*** Credential ${assetId} successfully revoked`);
}
