// src/vc-demo.ts

import crypto from 'crypto';
import * as ed25519 from '@transmute/did-key-ed25519';

// Dizendo ao TS para usar a resolução de módulos ES para encontrar este tipo
import type { Issuer } from 'did-jwt-vc' with { 'resolution-mode': 'import' };

export async function runVcDemo(): Promise<void> {
    console.log("💡 Iniciando a demonstração de Credenciais Verificáveis (VC)...");

    // ******** Usando importação dinâmica para um módulo ESM *********
    const { createVerifiableCredentialJwt, verifyCredential} = await import('did-jwt-vc');
    const { EdDSASigner } = await import('did-jwt');
    const { Resolver } = await import('did-resolver');
    const getKeyResolver = (await import('key-did-resolver')).getResolver;

    // ******** Gerando o did:key do emissor *********
    const { didDocument, keys } = await ed25519.generate(
        {
            secureRandom: () => {
                return crypto.randomBytes(32);
            },
        },
        { accept: 'application/did+json' }
    );

    console.log('DID Gerado:', didDocument.id);

    const privateKeyJwk = keys[0].privateKeyJwk as { d: string;[key: string]: any };
    const privateKeyBytes = Buffer.from(privateKeyJwk.d, 'base64url');

    // ******** Preparando o Emissor (Issuer) *********
    const signer = EdDSASigner(privateKeyBytes);

    const issuer: Issuer = {
        did: didDocument.id,
        signer: signer,
        alg: 'EdDSA',
    };

    // ******** Definindo o payload da VC *********
    const vcPayload = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'UniversityDegree'],
        issuer: issuer.did, // O DID do emissor
        issuanceDate: new Date().toISOString(), // Data no formato ISO 8601
        credentialSubject: {
            id: 'did:example:ebfeb1f712ebc6f1c276e12ec21',
            degree: {
                type: 'BachelorDegree',
                name: 'Computer Science'
            }
        },
    };

    // ******** Criando e assinando a VC no formato JWT *********
    console.log('\nCriando a Credencial JWT...');
    const vcJwt = await createVerifiableCredentialJwt(vcPayload, issuer);
    console.log('\n✅ Credencial JWT gerada com sucesso!');
    console.log(vcJwt);

    // ******** Verificando a Credencial *********
    console.log('\n--------------------------------------------------');
    console.log('Iniciando a verificação da Credencial...');

    const keyResolver = getKeyResolver();
    const resolver = new Resolver({
        ...keyResolver
    });

    try {
        const verifiedVc = await verifyCredential(vcJwt, resolver);
        console.log('\n✅ Verificação concluída com sucesso!');
        console.log('A credencial é autêntica.');
        console.log('\nPayload da Credencial Verificada:');
        console.log(JSON.stringify(verifiedVc, null, 2));

    } catch (error: any) {
        console.error('\n❌ Falha ao verificar a credencial:', error.message);
    }
}