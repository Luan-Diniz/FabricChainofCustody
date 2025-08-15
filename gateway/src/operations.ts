
export async function create_evidence(issuer_did: string): Promise<void> {
    // Preciso do did de quem fizer a operação --> ele será o owner.

    // Creates credential and store in database.
    // Stores data in blockchain.
    ;
}

export async function update_evidence(): Promise<void> {
    // Creates a new credential and store it in database (with a new id and a
    // reference to the old version)

    // Change status to the old credential to revoked.
    // Stores the new credential data in blockchain.

}

export async function transfer_evidence_ownership(): Promise<void> {
    //  Change owner --> in blockchain data and db data.
}
