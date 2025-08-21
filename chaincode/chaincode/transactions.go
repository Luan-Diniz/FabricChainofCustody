package chaincode

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

// SmartContract define a estrutura base para o seu chaincode.
type SmartContract struct {
	contractapi.Contract
}

// Asset representa uma credencial verificável no ledger.
// O campo CredentialHash foi adicionado.
type Asset struct {
	Status          string `json:"status"`            // "active" ou "revoked"
	Timestamp       string `json:"timestamp"`         // Formato ISO8601 ou Unix timestamp
	OwnerDID        string `json:"owner_did"`         // DID do proprietário da credencial
	IssuerDID       string `json:"issuer_did"`        // DID do emissor
	CredentialID    string `json:"credential_id"`     // Identificador único da credencial
	CredentialHash  string `json:"credential_hash"`   // Alteração: Hash da credencial original.
	LastModifierDID string `json:"last_modifier_did"` // DID de quem fez a última modificação
}

// CreateAsset cria uma nova credencial no ledger.
// O parâmetro credentialHash foi adicionado.
func (s *SmartContract) CreateAsset(ctx contractapi.TransactionContextInterface, credentialID string, status string, issuerDID string, ownerDID string, credentialHash string, timestamp string) error {
	exists, err := s.AssetExists(ctx, credentialID)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("a credencial %s já existe", credentialID)
	}

	asset := Asset{
		CredentialID:    credentialID,
		Status:          status,
		IssuerDID:       issuerDID,
		OwnerDID:        ownerDID,
		CredentialHash:  credentialHash, // Alteração: Inclui o hash na criação.
		Timestamp:       timestamp,
		LastModifierDID: ownerDID, // Lógica revertida para a original.
	}
	assetJSON, err := json.Marshal(asset)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(credentialID, assetJSON)
}

// TransferOwnership atualiza o proprietário (OwnerDID) de uma credencial existente.
func (s *SmartContract) TransferOwnership(ctx contractapi.TransactionContextInterface, credentialID string, newOwnerDID string) error {
	asset, err := s.ReadAsset(ctx, credentialID)
	if err != nil {
		return err
	}

	// Lógica revertida para a original: Apenas o OwnerDID é alterado.
	asset.OwnerDID = newOwnerDID

	assetJSON, err := json.Marshal(asset)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(credentialID, assetJSON)
}


// RevokeAsset altera o status de uma credencial para "revoked".
func (s *SmartContract) RevokeAsset(ctx contractapi.TransactionContextInterface, credentialID string) error {
	asset, err := s.ReadAsset(ctx, credentialID)
	if err != nil {
		return err
	}

	asset.Status = "revoked"
	asset.Timestamp = time.Now().UTC().Format(time.RFC3339)
	//asset.LastModifierDID = modifierDID // Lógica revertida para a original.

	assetJSON, err := json.Marshal(asset)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(credentialID, assetJSON)
}