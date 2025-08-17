// src/vc-demo.ts

// Dizendo ao TS para usar a resolução de módulos ES para encontrar este tipo.
// Esta é a correção para o erro de 'resolution-mode'.
//import type { DIDDocument } from 'did-resolver' with { 'resolution-mode': 'import' };
import type { Issuer, VerifiedCredential } from 'did-jwt-vc' with { 'resolution-mode': 'import' };
import { createIssuer } from './util';


export interface EvidenceRecordData {
    what: string;
    who: string;
    where: string;
    when: string;
    why: string;
    how: string;
}

export interface CredentialSubjectData {
    did_owner: string;
    id: string;
    previous_credential_id: string | null;
    evidence_record: EvidenceRecordData;
}


/**
 * Cria uma nova Credencial Verificável (VC) no formato JWT.
 */
export async function createCredential(subject_data: CredentialSubjectData,
                                       issuer: Issuer
                                    ): Promise<string> 
{

    console.log("🔑 Gerando DID do emissor e criando a credencial...");

    // ******** Usando importação dinâmica para módulos ESM *********
    const { createVerifiableCredentialJwt } = await import('did-jwt-vc');

    // 3. Definir o payload (claims) da VC
    const vcPayload = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'Evidence'],
        issuer: issuer.did,
        issuanceDate: new Date().toISOString(),
        credentialSubject: subject_data,
    };

    // 4. Criar e assinar a VC no formato JWT
    const vcJwt = await createVerifiableCredentialJwt(vcPayload, issuer);
    
    console.log('\n✅ Credencial JWT gerada com sucesso!');
    console.log(vcJwt);

    return vcJwt;
}

/**
 * Verifica a autenticidade e integridade de uma Credencial Verificável em formato JWT.
 */
export async function verifyCreatedCredential(vcJwt: string): Promise<VerifiedCredential> {
    // ******** Usando importação dinâmica para módulos ESM *********
    const { verifyCredential } = await import('did-jwt-vc');
    const { Resolver } = await import('did-resolver');
    const { getResolver: getKeyResolver } = await import('key-did-resolver');

    // 1. Configurar o resolver
    const keyResolver = getKeyResolver();
    const resolver = new Resolver({
        ...keyResolver
    });

    // 2. Verificar a credencial
    try {
        const verifiedVc = await verifyCredential(vcJwt, resolver);
        console.log('\n✅ Verificação concluída com sucesso!');
        console.log('A credencial é autêntica.');
        return verifiedVc;
    } catch (error: any) {
        console.error('\n❌ Falha ao verificar a credencial:', error.message);
        throw error;
    }
}

/**
 * Função principal para executar a demonstração.
 */
export async function runVcDemo(): Promise<void> {
    console.log("💡 Iniciando a demonstração de Credenciais Verificáveis (VC)...\n");

    try {

        const my_subject = {
            did_owner: 'did:example:owner',
            id: 'did:example:ebfeb1f712ebc6f1c276e12ec21',
            status: 'active',
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

        // Passo 1: Criar a credencial
        const issuer = (await createIssuer()).issuer;
        const vcJwt = await createCredential(my_subject, issuer);
        
        //console.log('\nDID do Emissor utilizado:', issuerDidDocument.id);

        // Passo 2: Verificar a credencial recém-criada
        const verifiedCredential = await verifyCreatedCredential(vcJwt);

        console.log('\n🧾 Payload da Credencial Verificada:');
        console.log(JSON.stringify(verifiedCredential, null, 2));

    } catch (error) {
        console.error("\n💥 Ocorreu um erro durante a demonstração:", error);
    }
}