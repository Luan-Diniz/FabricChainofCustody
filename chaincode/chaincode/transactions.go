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
// O campo LastModifierDID foi adicionado.
type Asset struct {
	Status          string `json:"status"`            // "active" ou "revoked"
	Timestamp       string `json:"timestamp"`         // Formato ISO8601 ou Unix timestamp
	OwnerDID        string `json:"owner_did"`         // DID do proprietário da credencial
	IssuerDID       string `json:"issuer_did"`        // DID do emissor
	CredentialID    string `json:"credential_id"`     // Identificador único da credencial
	LastModifierDID string `json:"last_modifier_did"` // DID de quem fez a última modificação
}

// CreateAsset cria uma nova credencial no ledger.
func (s *SmartContract) CreateAsset(ctx contractapi.TransactionContextInterface, credentialID string, status string, issuerDID string, ownerDID string, timestamp string) error {
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
		Timestamp:       timestamp,
		LastModifierDID: issuerDID, // Na criação, o emissor é o primeiro modificador.
	}
	assetJSON, err := json.Marshal(asset)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(credentialID, assetJSON)
}

// TransferOwnership atualiza o proprietário (OwnerDID) de uma credencial existente,
// registrando quem fez a transferência.
func (s *SmartContract) TransferOwnership(ctx contractapi.TransactionContextInterface, credentialID string, newOwnerDID string) error {
	// 1. Ler o ativo existente do ledger para garantir que ele existe e para
	// preservar seus outros dados (como Status, IssuerDID, etc.).
	asset, err := s.ReadAsset(ctx, credentialID)
	if err != nil {
		return err // Retorna o erro de ReadAsset (ex: "a credencial ... não existe")
	}

	// 2. Atualizar apenas os campos relevantes para a transferência.
	asset.OwnerDID = newOwnerDID
	//asset.Timestamp = time.Now().UTC().Format(time.RFC3339) // Atualiza o timestamp para a data da transferência.

	// 3. Converter o ativo modificado de volta para JSON.
	assetJSON, err := json.Marshal(asset)
	if err != nil {
		return err
	}

	// 4. Salvar o estado atualizado no ledger.
	return ctx.GetStub().PutState(credentialID, assetJSON)
}


// UpdateAsset atualiza uma credencial existente.
// O parâmetro modifierDID foi adicionado para rastrear quem fez a alteração.
func (s *SmartContract) UpdateAsset(ctx contractapi.TransactionContextInterface, credentialID string, status string, issuerDID string, ownerDID string, modifierDID string, timestamp string) error {
	exists, err := s.AssetExists(ctx, credentialID)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("a credencial %s não existe", credentialID)
	}

	asset := Asset{
		CredentialID:    credentialID,
		Status:          status,
		IssuerDID:       issuerDID,
		OwnerDID:        ownerDID,
		Timestamp:       timestamp,
		LastModifierDID: modifierDID, // Registra o DID de quem está atualizando.
	}
	assetJSON, err := json.Marshal(asset)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(credentialID, assetJSON)
}

// DeleteAsset remove uma credencial do ledger.
// (Nenhuma alteração necessária aqui)
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
// O parâmetro modifierDID foi adicionado para registrar quem revogou.
func (s *SmartContract) RevokeAsset(ctx contractapi.TransactionContextInterface, credentialID string, modifierDID string) error {
	asset, err := s.ReadAsset(ctx, credentialID)
	if err != nil {
		return err
	}

	asset.Status = "revoked"
	asset.Timestamp = time.Now().UTC().Format(time.RFC3339)
	//asset.LastModifierDID = modifierDID // Registra o DID de quem está revogando.

	assetJSON, err := json.Marshal(asset)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(credentialID, assetJSON)
}

