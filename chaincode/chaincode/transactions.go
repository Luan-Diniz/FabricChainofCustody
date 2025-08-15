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
type Asset struct {
	Status       string `json:"status"`       // "active" ou "revoked"
	Timestamp    string `json:"timestamp"`    // Formato ISO8601 ou Unix timestamp
	IssuerDID    string `json:"issuer_did"`   // Decentralized Identifier do emissor
	CredentialID string `json:"credential_id"`// Identificador único da credencial
}

// InitLedger adiciona um conjunto inicial de credenciais ao ledger para fins de teste.
func (s *SmartContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	credentials := []Asset{
		{CredentialID: "cred1", Status: "active", Timestamp: time.Now().UTC().Format(time.RFC3339), IssuerDID: "did:example:issuer1"},
		{CredentialID: "cred2", Status: "revoked", Timestamp: time.Now().UTC().Format(time.RFC3339), IssuerDID: "did:example:issuer2"},
	}

	for _, cred := range credentials {
		credJSON, err := json.Marshal(cred)
		if err != nil {
			return err
		}
		err = ctx.GetStub().PutState(cred.CredentialID, credJSON)
		if err != nil {
			return fmt.Errorf("falha ao gravar no world state: %v", err)
		}
	}
	return nil
}

// CreateAsset cria uma nova credencial no ledger.
func (s *SmartContract) CreateAsset(ctx contractapi.TransactionContextInterface, credentialID string, status string, issuerDID string, timestamp string) error {
	exists, err := s.AssetExists(ctx, credentialID)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("a credencial %s já existe", credentialID)
	}

	asset := Asset{
		CredentialID: credentialID,
		Status:       status,
		IssuerDID:    issuerDID,
		Timestamp:    timestamp,
	}
	assetJSON, err := json.Marshal(asset)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(credentialID, assetJSON)
}

// UpdateAsset atualiza uma credencial existente.
func (s *SmartContract) UpdateAsset(ctx contractapi.TransactionContextInterface, credentialID string, status string, issuerDID string, timestamp string) error {
	exists, err := s.AssetExists(ctx, credentialID)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("a credencial %s não existe", credentialID)
	}

	asset := Asset{
		CredentialID: credentialID,
		Status:       status,
		IssuerDID:    issuerDID,
		Timestamp:    timestamp,
	}
	assetJSON, err := json.Marshal(asset)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(credentialID, assetJSON)
}

// DeleteAsset remove uma credencial do ledger.
func (s *SmartContract) DeleteAsset(ctx contractapi.TransactionContextInterface, credentialID string) error {
	exists, err := s.AssetExists(ctx, credentialID)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("a credencial %s não existe", credentialID)
	}
	return ctx.GetStub().DelState(credentialID)
}

// RevokeAsset altera o status de uma credencial para "revoked".
func (s *SmartContract) RevokeAsset(ctx contractapi.TransactionContextInterface, credentialID string) error {
	asset, err := s.ReadAsset(ctx, credentialID)
	if err != nil {
		return err
	}

	asset.Status = "revoked"
	asset.Timestamp = time.Now().UTC().Format(time.RFC3339)

	assetJSON, err := json.Marshal(asset)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(credentialID, assetJSON)
}