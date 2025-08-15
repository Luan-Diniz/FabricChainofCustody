package chaincode

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

// ReadAsset recupera uma credencial do ledger pelo seu ID.
func (s *SmartContract) ReadAsset(ctx contractapi.TransactionContextInterface, credentialID string) (*Asset, error) {
	assetJSON, err := ctx.GetStub().GetState(credentialID)
	if err != nil {
		return nil, fmt.Errorf("falha ao ler do world state: %v", err)
	}
	if assetJSON == nil {
		return nil, fmt.Errorf("a credencial %s não existe", credentialID)
	}

	var asset Asset
	err = json.Unmarshal(assetJSON, &asset)
	if err != nil {
		return nil, err
	}
	return &asset, nil
}

// AssetExists verifica se uma credencial com o ID especificado existe no ledger.
func (s *SmartContract) AssetExists(ctx contractapi.TransactionContextInterface, credentialID string) (bool, error) {
	assetJSON, err := ctx.GetStub().GetState(credentialID)
	if err != nil {
		return false, fmt.Errorf("falha ao ler do world state: %v", err)
	}
	return assetJSON != nil, nil
}

// GetAllAssets retorna todas as credenciais atualmente armazenadas no ledger.
func (s *SmartContract) GetAllAssets(ctx contractapi.TransactionContextInterface) ([]*Asset, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var assets []*Asset
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var asset Asset
		err = json.Unmarshal(queryResponse.Value, &asset)
		if err != nil {
			return nil, err
		}
		assets = append(assets, &asset)
	}
	return assets, nil
}