import { program } from '@command';
import {
  fetchAllLidoKeys,
  fetchAllValidators,
  fetchFork,
  fetchGenesis,
  fetchSpec,
  fetchValidator,
  KAPIKey,
  postToAttestationPool,
} from '@providers';
import { deriveEth2ValidatorKeys, deriveKeyFromMnemonic } from '@chainsafe/bls-keygen';
import { AttestationDataBigint, computeDomain, signAttestationData } from '@consensus';
import { getBytes, hexlify } from 'ethers';

const validators = program.command('validators').description('validators utils');

validators
  .command('0x00')
  .description('fetches lido validators with 0x00 withdraw credentials')
  .action(async () => {
    console.log('fetching keys from KAPI, it may take a while...');
    const keys = await fetchAllLidoKeys();

    console.log('fetching validators from CL, it may take a few minutes...');
    const validators = await fetchAllValidators();

    const keysMap = keys.reduce((acc, signingKey) => {
      acc[signingKey.key] = signingKey;
      return acc;
    }, {} as Record<string, KAPIKey>);

    const lidoValidators = validators.filter(({ validator }) => {
      return keysMap[validator.pubkey];
    });

    console.log('validators on CL', lidoValidators.length);

    const validatorsWith0x00WC = lidoValidators.filter(({ validator }) => {
      return validator.withdrawal_credentials.startsWith('0x00');
    });

    console.log('validators with 0x00 wc', validatorsWith0x00WC.length);

    const nodeOperatorIds = validatorsWith0x00WC.reduce((acc, { validator }) => {
      const key = keysMap[validator.pubkey];
      if (!acc[key.operatorIndex]) {
        acc[key.operatorIndex] = 0;
      }

      acc[key.operatorIndex] += 1;
      return acc;
    }, {} as Record<number, number>);

    console.log('operators with 0x00 wc', nodeOperatorIds);
  });

validators
  .command('slash-by-attestations')
  .description('slash a validator by attestations ')
  .argument('<mnemonic>', 'mnemonic')
  .argument('<index>', 'index of key')
  .argument('<slot>', 'slot')
  .action(async (mnemonic, index, slot) => {
    const masterSK = deriveKeyFromMnemonic(mnemonic);
    const { signing } = deriveEth2ValidatorKeys(masterSK, index);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SecretKey } = require('@chainsafe/blst');
    const sk = SecretKey.fromBytes(signing);
    const pkHex = hexlify(sk.toPublicKey().toBytes());

    const genesis = await fetchGenesis();
    const genesisValidatorsRoot = getBytes(genesis.genesis_validators_root);

    const fork = await fetchFork();
    const forkVersion = getBytes(fork.current_version);

    const { validator, index: validatorIndex } = await fetchValidator(pkHex);

    const spec = await fetchSpec();
    const epoch = String(Math.floor(slot / Number(spec.SLOTS_PER_EPOCH)));

    if (validator.slashed) {
      console.warn(`validator is already slashed`);
      return;
    }

    const DOMAIN_BEACON_ATTESTER = Uint8Array.from([1, 0, 0, 0]);
    const domain = computeDomain(DOMAIN_BEACON_ATTESTER, forkVersion, genesisValidatorsRoot);

    const rootA = hexlify(Buffer.alloc(32, 0xaa));
    const rootB = hexlify(Buffer.alloc(32, 0xbb));

    const data1 = {
      slot,
      index: '0',
      beacon_block_root: rootA,
      source: { epoch, root: rootA },
      target: { epoch, root: rootB },
    };
    const data2 = {
      slot,
      index: '0',
      beacon_block_root: rootB,
      source: { epoch, root: rootA },
      target: { epoch, root: rootB },
    };

    const attesterSlashing = {
      attestation_1: {
        attesting_indices: [validatorIndex],
        data: data1,
        signature: hexlify(signAttestationData(domain, sk, AttestationDataBigint.fromJson(data1))),
      },
      attestation_2: {
        attesting_indices: [validatorIndex],
        data: data2,
        signature: hexlify(signAttestationData(domain, sk, AttestationDataBigint.fromJson(data2))),
      },
    };

    const result = await postToAttestationPool(attesterSlashing);
    console.log(result);
  });
