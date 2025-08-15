import { MongoClient, ObjectId } from 'mongodb';

// Connection URI
const uri = 'mongodb://root:password@localhost:27017/?authSource=admin';

// Create a new MongoClient
const client = new MongoClient(uri);

interface VerifiableCredential {
    '@context': string[];
    id: string;
    type: string[];
    issuer: string;
    issuanceDate: string;
    credentialSubject: {
        id: string;
        degree: {
            type: string;
            name: string;
        };
    };
    proof: {
        type: string;
        created: string;
        proofPurpose: string;
        verificationMethod: string;
        jws: string;
    };
    _id?: ObjectId;
}


export async function run() {
    try {
        // Connect the client to the server
        await client.connect();
        console.log('Connected successfully to MongoDB');

        const database = client.db('verifiable_credentials_db');
        const credentials = database.collection<VerifiableCredential>('credentials');

        // 1. CREATE a new Verifiable Credential
        console.log('\n--- CREATE ---');
        const newCredential: VerifiableCredential = {
            "@context": [
                "https://www.w3.org/2018/credentials/v1",
                "https://www.w3.org/2018/credentials/examples/v1"
            ],
            "id": "http://example.edu/credentials/3732",
            "type": ["VerifiableCredential", "UniversityDegreeCredential"],
            "issuer": "https://example.edu/issuers/14",
            "issuanceDate": "2020-03-10T04:24:12.164Z",
            "credentialSubject": {
                "id": "did:example:ebfeb1f712ebc6f1c276e12ec21",
                "degree": {
                    "type": "BachelorDegree",
                    "name": "Bachelor of Science and Arts"
                }
            },
            "proof": {
                "type": "RsaSignature2018",
                "created": "2020-03-10T04:24:12.164Z",
                "proofPurpose": "assertionMethod",
                "verificationMethod": "https://example.edu/issuers/14#key-1",
                "jws": "eyJhbGciOiJSUzI1NiIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..TCYt5X"
            }
        };

        const createResult = await credentials.insertOne(newCredential);
        console.log(`New credential created with the following id: ${createResult.insertedId}`);

        // 2. READ the created credential
        console.log('\n--- READ ---');
        const foundCredential = await credentials.findOne({ _id: createResult.insertedId });
        if (foundCredential) {
            console.log('Found credential:');
            console.log(JSON.stringify(foundCredential, null, 2));
        } else {
            console.log('Credential not found.');
        }

        // 3. UPDATE the credential
        console.log('\n--- UPDATE ---');
        const updateResult = await credentials.updateOne(
            { _id: createResult.insertedId },
            { $set: { "credentialSubject.degree.name": "Bachelor of Innovation in Technology" } }
        );
        console.log(`${updateResult.modifiedCount} document(s) was/were updated.`);
        const updatedCredential = await credentials.findOne({ _id: createResult.insertedId });
        if (updatedCredential) {
            console.log('Updated credential:');
            console.log(JSON.stringify(updatedCredential, null, 2));
        }


        // 4. DELETE the credential
        console.log('\n--- DELETE ---');
        const deleteResult = await credentials.deleteOne({ _id: createResult.insertedId });
        console.log(`${deleteResult.deletedCount} document(s) was/were deleted.`);
        const deletedCredential = await credentials.findOne({ _id: createResult.insertedId });
        console.log(deletedCredential ? 'Deletion failed.' : 'Credential successfully deleted.');


    } finally {
        // Ensures that the client will close when you finish/error
        await client.close();
        console.log('\nConnection to MongoDB closed.');
    }
}
