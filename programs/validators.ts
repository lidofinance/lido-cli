import { program } from '@command';
import {
  FAR_FUTURE_EPOCH,
  fetchAllLidoKeys,
  fetchAllValidators,
  fetchBlockHeader,
  fetchFork,
  fetchGenesis,
  fetchSpec,
  fetchValidator,
  KAPIKey,
  postToAttestationPool,
  postToVoluntaryExitsPool,
} from '@providers';
import { deriveEth2ValidatorKeys, deriveKeyFromMnemonic } from '@chainsafe/bls-keygen';
import {
  AttestationDataBigint,
  VoluntaryExit,
  computeDomain,
  computeSigningRoot,
  signAttestationData,
  signVoluntaryExit,
} from '@consensus';
import { depositContract } from '@contracts';
import { getBytes, hexlify, parseEther } from 'ethers';
import { detectConsensusVersionByEpoch, logger, writeToFile } from '@utils';

const validators = program.command('validators').description('validators utils');

validators
  .command('0x00')
  .description('fetches lido validators with 0x00 withdraw credentials')
  .action(async () => {
    logger.log('Fetching keys from KAPI, it may take a while...');
    const keys = await fetchAllLidoKeys();

    logger.log('Fetching validators from CL, it may take a few minutes...');
    const validators = await fetchAllValidators();

    logger.log('All validators on CL', validators.length);

    const keysMap = keys.reduce(
      (acc, signingKey) => {
        acc[signingKey.key] = signingKey;
        return acc;
      },
      {} as Record<string, KAPIKey>,
    );

    const lidoValidators = validators.filter(({ validator }) => {
      return keysMap[validator.pubkey];
    });

    logger.log('Lido validators on CL', lidoValidators.length);

    const validatorsWith0x00WC = lidoValidators.filter(({ validator }) => {
      return validator.withdrawal_credentials.startsWith('0x00');
    });

    logger.log('Lido validators with 0x00 wc', validatorsWith0x00WC.length);

    const nodeOperatorIds = validatorsWith0x00WC.reduce(
      (acc, { validator }) => {
        const key = keysMap[validator.pubkey];
        if (!acc[key.operatorIndex]) {
          acc[key.operatorIndex] = 0;
        }

        acc[key.operatorIndex] += 1;
        return acc;
      },
      {} as Record<number, number>,
    );

    logger.log('Operators with 0x00 wc', nodeOperatorIds);
  });

validators
  .command('statuses')
  .description('fetches validators statuses by operator')
  .action(async () => {
    logger.log('Fetching keys from KAPI, it may take a while...');
    const keys = await fetchAllLidoKeys();

    logger.log('Fetching validators from CL, it may take a few minutes...');
    const validators = await fetchAllValidators();

    logger.log('All validators on CL', validators.length);

    const keysMap = keys.reduce(
      (acc, signingKey) => {
        acc[signingKey.key] = signingKey;
        return acc;
      },
      {} as Record<string, KAPIKey>,
    );

    const lidoValidators = validators.filter(({ validator }) => {
      return keysMap[validator.pubkey];
    });

    logger.log('Lido validators on CL', lidoValidators.length);

    const statsByModuleAndOperator = lidoValidators.reduce(
      (acc, { validator, status }) => {
        const key = keysMap[validator.pubkey];
        const { moduleAddress, operatorIndex } = key;

        if (!acc[moduleAddress]) {
          acc[moduleAddress] = {};
        }

        if (!acc[moduleAddress][operatorIndex]) {
          acc[moduleAddress][operatorIndex] = { operatorIndex };
        }

        const operatorStats = acc[moduleAddress][operatorIndex];

        if (!operatorStats[status]) operatorStats[status] = 0;
        operatorStats[status] += 1;

        return acc;
      },
      {} as Record<string, Record<number, Record<string, number>>>,
    );

    Object.entries(statsByModuleAndOperator).forEach(([moduleAddress, statsByOperator]) => {
      logger.log('Module', moduleAddress);
      logger.table(Object.values(statsByOperator));
    });
  });

validators
  .command('lido-validators-by-statuses')
  .description('fetches lido validators statuses by statuses')
  .argument('<module-address>', 'module address')
  .option('-f, --file-name <string>', 'file name to store result', 'active-keys.json')
  .option('-s, --status-list <string...>', 'list of validators statuses')
  .action(async (moduleAddress, options) => {
    const { fileName, statusList } = options;

    logger.log('Fetching keys from KAPI, it may take a while...');
    const keys = await fetchAllLidoKeys();

    logger.log('Fetching validators from CL, it may take a few minutes...');
    const validators = await fetchAllValidators();

    logger.log('All validators on CL', validators.length);

    const keysMap = keys.reduce(
      (acc, signingKey) => {
        acc[signingKey.key] = signingKey;
        return acc;
      },
      {} as Record<string, KAPIKey>,
    );

    const lidoValidators = validators
      .filter(({ validator, status }) => {
        const key = keysMap[validator.pubkey];
        return key && key.moduleAddress === moduleAddress && statusList.includes(status);
      })
      .map(({ validator, status, index }) => {
        const key = keysMap[validator.pubkey];
        return { key, status, index };
      });

    logger.log(`Lido validators on CL with statuses [${statusList.join(', ')}]: ${lidoValidators.length}`);

    const jsonData = JSON.stringify(lidoValidators, null, 2);

    await writeToFile(fileName, jsonData);
  });

validators
  .command('voluntary-exit')
  .description('submit a voluntary exit for a validator')
  .argument('<mnemonic>', 'mnemonic')
  .argument('<index>', 'index of key')
  .action(async (mnemonic, index) => {
    const masterSK = deriveKeyFromMnemonic(mnemonic);
    const { signing } = deriveEth2ValidatorKeys(masterSK, index);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SecretKey } = require('@chainsafe/blst');
    const sk = SecretKey.fromBytes(signing);
    const pkHex = hexlify(sk.toPublicKey().toBytes());

    const genesis = await fetchGenesis();
    const genesisValidatorsRoot = getBytes(genesis.genesis_validators_root);

    const headBlockHeader = await fetchBlockHeader('head');
    const headSlot = Number(headBlockHeader.header.message.slot);

    const { validator, index: validatorIndex } = await fetchValidator(pkHex);

    if (validator.exit_epoch != FAR_FUTURE_EPOCH.toString()) {
      logger.warn('Validator is already exiting');
      return;
    }

    const spec = await fetchSpec();
    const exitEpoch = String(Math.floor(headSlot / Number(spec.SLOTS_PER_EPOCH)));
    const forkVersion = getBytes(spec.CAPELLA_FORK_VERSION);

    const DOMAIN_VOLUNTARY_EXIT = Uint8Array.from([4, 0, 0, 0]);
    const domain = computeDomain(DOMAIN_VOLUNTARY_EXIT, forkVersion, genesisValidatorsRoot);

    const voluntaryExitMessage = {
      epoch: exitEpoch,
      validator_index: validatorIndex,
    };

    const voluntaryExit = {
      message: voluntaryExitMessage,
      signature: hexlify(signVoluntaryExit(domain, sk, VoluntaryExit.fromJson(voluntaryExitMessage))),
    };

    const result = await postToVoluntaryExitsPool(voluntaryExit);
    logger.log(result.statusText);
  });

validators
  .command('exit-message')
  .description('sign a voluntary exit and write it to a JSON file (for the validator-ejector messages folder)')
  .argument('<mnemonic>', 'mnemonic')
  .argument('<index>', 'index of key')
  .option('-o, --out-dir <string>', 'directory to write the message file into', '.')
  .action(async (mnemonic, index, options) => {
    const masterSK = deriveKeyFromMnemonic(mnemonic);
    const { signing } = deriveEth2ValidatorKeys(masterSK, index);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SecretKey } = require('@chainsafe/blst');
    const sk = SecretKey.fromBytes(signing);
    const pkHex = hexlify(sk.toPublicKey().toBytes());

    const genesis = await fetchGenesis();
    const genesisValidatorsRoot = getBytes(genesis.genesis_validators_root);

    const headBlockHeader = await fetchBlockHeader('head');
    const headSlot = Number(headBlockHeader.header.message.slot);

    const { validator, index: validatorIndex } = await fetchValidator(pkHex);
    if (validator.exit_epoch != FAR_FUTURE_EPOCH.toString()) {
      logger.warn(`Validator ${validatorIndex} is already exiting, skipping`);
      return;
    }

    const spec = await fetchSpec();
    const exitEpoch = String(Math.floor(headSlot / Number(spec.SLOTS_PER_EPOCH)));
    const forkVersion = getBytes(spec.CAPELLA_FORK_VERSION);

    const DOMAIN_VOLUNTARY_EXIT = Uint8Array.from([4, 0, 0, 0]);
    const domain = computeDomain(DOMAIN_VOLUNTARY_EXIT, forkVersion, genesisValidatorsRoot);

    const message = { epoch: exitEpoch, validator_index: validatorIndex };
    const voluntaryExit = {
      message,
      signature: hexlify(signVoluntaryExit(domain, sk, VoluntaryExit.fromJson(message))),
    };

    await writeToFile(`${options.outDir}/exit-${validatorIndex}.json`, JSON.stringify(voluntaryExit, null, 2));
    logger.log('Exit message written', { validatorIndex, pubkey: pkHex, file: `exit-${validatorIndex}.json` });
  });

validators
  .command('frontrun-deposit')
  .description(
    'deposit an operator key to the deposit contract with a chosen (non-Lido) withdrawal credentials — creates the historical front-run the council pauses on',
  )
  .argument('<mnemonic>', 'mnemonic')
  .argument('<index>', 'index of key')
  .argument('<withdrawal-credentials>', '0x-prefixed 32-byte WC (non-Lido, to simulate the theft)')
  .option(
    '-f, --fork-version <string>',
    'genesis fork version for a chain without a CL to query (e.g. an EL-only fork); use the devnet genesisForkVersion',
  )
  .option(
    '-a, --amount <string>',
    'deposit amount in ETH (>= 1); the first deposit sets the WC, so 1 is enough to front-run',
    '1',
  )
  .action(async (mnemonic, index, wc, options) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ContainerType, ByteVectorType, UintBigintType } = require('@chainsafe/ssz');
    const Bytes48 = new ByteVectorType(48);
    const Bytes32 = new ByteVectorType(32);
    const Bytes96 = new ByteVectorType(96);
    const UintBn64 = new UintBigintType(8);
    // SSZ field order follows the ETH2 spec: pubkey, wc, amount, signature.
    const DepositMessage = new ContainerType({ pubkey: Bytes48, withdrawalCredentials: Bytes32, amount: UintBn64 });
    const DepositData = new ContainerType({
      pubkey: Bytes48,
      withdrawalCredentials: Bytes32,
      amount: UintBn64,
      signature: Bytes96,
    });

    const wcBytes = getBytes(wc);
    if (wcBytes.length !== 32) throw new Error('withdrawal-credentials must be 32 bytes');

    const masterSK = deriveKeyFromMnemonic(mnemonic);
    const { signing } = deriveEth2ValidatorKeys(masterSK, index);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SecretKey } = require('@chainsafe/blst');
    const sk = SecretKey.fromBytes(signing);
    const pubkey = sk.toPublicKey().toBytes();
    const value = parseEther(options.amount);
    const amountGwei = value / 1_000_000_000n; // gwei, as the deposit contract computes it

    // Deposits are cross-fork: domain uses the genesis fork version and a zero
    // genesis validators root. Read it from the CL, or take the override when
    // there is no CL (an EL-only fork). The deposit contract does not verify the
    // BLS signature, so this only affects the (unchecked) signature bytes.
    const forkVersion = getBytes(options.forkVersion ?? (await fetchSpec()).GENESIS_FORK_VERSION);
    const DOMAIN_DEPOSIT = Uint8Array.from([3, 0, 0, 0]);
    const domain = computeDomain(DOMAIN_DEPOSIT, forkVersion, new Uint8Array(32));

    const message = { pubkey, withdrawalCredentials: wcBytes, amount: amountGwei };
    const sig = sk.sign(computeSigningRoot(DepositMessage, message, domain)).toBytes();
    const depositDataRoot = DepositData.hashTreeRoot({ ...message, signature: sig });

    logger.log('Front-run deposit', {
      pubkey: hexlify(pubkey),
      withdrawalCredentials: hexlify(wcBytes),
      depositDataRoot: hexlify(depositDataRoot),
    });
    const tx = await depositContract.deposit(
      hexlify(pubkey),
      hexlify(wcBytes),
      hexlify(sig),
      hexlify(depositDataRoot),
      {
        value,
      },
    );
    const receipt = await tx.wait();
    logger.log('Deposit sent', { tx: tx.hash, status: receipt?.status });
  });

validators
  .command('slash-by-attestations')
  .description('slash a validator by attestations')
  .argument('<mnemonic>', 'mnemonic')
  .argument('<index>', 'index of key')
  .argument('<slot>', 'slot')
  .action(async (mnemonic, index, slot) => {
    const masterSK = deriveKeyFromMnemonic(mnemonic);
    const { signing } = deriveEth2ValidatorKeys(masterSK, index);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
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
      logger.warn('Validator is already slashed');
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

    const consensusVersion = detectConsensusVersionByEpoch(spec, Number(epoch));
    const result = await postToAttestationPool(consensusVersion, attesterSlashing);
    logger.log(result);
  });
