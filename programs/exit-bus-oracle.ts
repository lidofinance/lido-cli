import { program } from '@command';
import { exitBusOracleContract } from '@contracts';
import {
  FAR_FUTURE_EPOCH,
  fetchAllLidoKeys,
  fetchAllValidators,
  fetchBlock,
  KAPIKey,
  ValidatorContainer,
  provider,
} from '@providers';
import { exportToCSV, getValidatorsMap, groupByModuleId, logger } from '@utils';
import { keccak256, AbiCoder, parseEther, ethers } from 'ethers';

import {
  addAccessControlSubCommands,
  addBaseOracleCommands,
  addLogsCommands,
  addOssifiableProxyCommands,
  addParsingCommands,
  addPauseUntilSubCommands,
} from './common';
import {
  fetchLastExitRequests,
  fetchLastExitRequestsDetailed,
  formatExitRequests,
  formatExitRequestsDetailed,
  groupRequestsByOperator,
} from './exit-bus';
import { getNodeOperators, getStakingModules } from './staking-module';
import { addVersionedSubCommands } from './common/versioned';

export type LidoValidator = {
  validator: ValidatorContainer;
  signingKey: KAPIKey;
};

const oracle = program
  .command('exit-bus-oracle')
  .aliases(['vebo'])
  .description('interact with validator exit bus oracle contract');
addAccessControlSubCommands(oracle, exitBusOracleContract);
addBaseOracleCommands(oracle, exitBusOracleContract);
addOssifiableProxyCommands(oracle, exitBusOracleContract);
addParsingCommands(oracle, exitBusOracleContract);
addPauseUntilSubCommands(oracle, exitBusOracleContract);
addLogsCommands(oracle, exitBusOracleContract);
addVersionedSubCommands(oracle, exitBusOracleContract);

oracle
  .command('exit-requests')
  .description('returns exit requests with details')
  .option('-b, --blocks <number>', 'duration in blocks', '7200')
  .action(async (options) => {
    const { blocks } = options;
    const requests = await fetchLastExitRequests(blocks);
    const groupedRequests = groupByModuleId(requests);

    Object.entries(groupedRequests).forEach(([moduleId, requests]) => {
      const formattedRequests = formatExitRequests(requests);
      logger.log('Module', moduleId);
      logger.table(formattedRequests);
    });
  });

oracle
  .command('exit-requests-detailed')
  .description('returns exit requests with details')
  .option('-b, --blocks <number>', 'duration in blocks', '7200')
  .option('-a, --agg', 'aggregated per operator')
  .action(async (options) => {
    const { blocks, agg } = options;
    const requests = await fetchLastExitRequestsDetailed(blocks);
    const groupedRequests = groupByModuleId(requests);

    Object.entries(groupedRequests).forEach(([moduleId, requests]) => {
      const formattedRequests = formatExitRequestsDetailed(requests);

      logger.log('Module', moduleId);

      if (agg) {
        const aggregatedRequestsByOperator = groupRequestsByOperator(formattedRequests);
        logger.table(aggregatedRequestsByOperator);
      } else {
        logger.table(formattedRequests);
      }
    });
  });

oracle
  .command('exit-requests-detailed-csv')
  .description('returns exit requests with details')
  .option('-b, --blocks <number>', 'duration in blocks', '7200')
  .action(async (options) => {
    const { blocks } = options;
    const requests = await fetchLastExitRequestsDetailed(blocks);
    const groupedRequests = groupByModuleId(requests);

    await Promise.all(
      Object.entries(groupedRequests).map(async ([moduleId, requests]) => {
        const formattedRequests = formatExitRequestsDetailed(requests);
        const fileName = `exit-requests-module-${moduleId}.csv`;
        await exportToCSV(formattedRequests, fileName);
      }),
    );
  });

oracle
  .command('format-list')
  .description('returns exit requests')
  .action(async () => {
    const value = await exitBusOracleContract.DATA_FORMAT_LIST();
    logger.log('Value', value);
  });

oracle
  .command('last-requested-validator-indices')
  .description('returns last requested validator indices')
  .action(async () => {
    const modules = await getStakingModules();

    modules.forEach(async (module) => {
      const operators = await getNodeOperators(module.stakingModuleAddress);
      const operatorIds = operators.map(({ operatorId }) => operatorId);

      const lastRequestedIndexes = await exitBusOracleContract.getLastRequestedValidatorIndices(module.id, operatorIds);
      const operatorsWithLastRequestedValidators = operators.map((operator, index) => {
        const { operatorId, name } = operator;
        const lastRequestedIndex = Number(lastRequestedIndexes[index]);

        return { operatorId, name, lastRequestedIndex };
      });

      logger.log('Module', module.id, module.stakingModuleAddress);
      logger.table(operatorsWithLastRequestedValidators);
    });
  });

oracle
  .command('unsettled-requests')
  .description('returns unsettled exit requests')
  .action(async () => {
    // fetch latest block on CL
    const block = await fetchBlock('head');
    const slot = block.message.slot;

    // fetch all Lido keys
    const lidoLeys = await fetchAllLidoKeys();

    // fetch validator from CL
    const validators = await fetchAllValidators(Number(slot));
    const validatorsMap = getValidatorsMap(validators);

    const operatorValidatorsMap = lidoLeys.reduce(
      (acc, signingKey) => {
        const { moduleAddress, operatorIndex } = signingKey;
        const pubkey = signingKey.key;
        const validator = validatorsMap[pubkey];

        if (!validator) return acc;
        if (!acc[moduleAddress]) acc[moduleAddress] = {} as Record<number, LidoValidator[]>;
        if (!acc[moduleAddress][operatorIndex]) acc[moduleAddress][operatorIndex] = [] as LidoValidator[];

        acc[moduleAddress][operatorIndex].push({ validator, signingKey });

        return acc;
      },
      {} as Record<string, Record<number, LidoValidator[]>>,
    );

    // fetch modules
    const modules = await getStakingModules();

    modules.forEach(async (module) => {
      logger.log('Module', module.id, module.stakingModuleAddress);

      const operators = await getNodeOperators(module.stakingModuleAddress);
      const operatorIds = operators.map(({ operatorId }) => operatorId);

      const lastRequestedIndexes = await exitBusOracleContract.getLastRequestedValidatorIndices(module.id, operatorIds);
      const detailedOperators = operators.map((operator, index) => {
        const { operatorId, name } = operator;
        const lastRequestedIndex = Number(lastRequestedIndexes[index]);

        if (lastRequestedIndex === -1) return { operatorId, name, lastRequestedIndex, exited: 0, unsettled: 0 };

        const operatorValidators = operatorValidatorsMap[module.stakingModuleAddress][operatorId];
        const requestedValidators = operatorValidators.filter(
          ({ validator }) => Number(validator.index) <= lastRequestedIndex,
        );
        const unsettledRequests = requestedValidators.filter(
          ({ validator }) => validator.validator.exit_epoch === FAR_FUTURE_EPOCH.toString(),
        );

        const exited = requestedValidators.length - unsettledRequests.length;
        const unsettled = unsettledRequests.length;

        if (unsettled > 0) {
          logger.log(`Operator #${operatorId} ${name} has unsettled requests`);
          logger.table(
            unsettledRequests.map(({ validator }) => {
              const {
                validator: { pubkey },
                index,
              } = validator;

              return { index, pubkey };
            }),
          );
          logger.log('');
        }

        return { operatorId, name, lastRequestedIndex, exited, unsettled };
      });

      const operatorsWithUnsettledRequests = detailedOperators.filter(({ unsettled }) => unsettled > 0);

      logger.log('Summary');
      logger.table(operatorsWithUnsettledRequests);
    });
  });

oracle
  .command('submit-hash')
  .description('Submit an Exit Request Hash')
  .option('--hash <hash>', 'Pre-calculated keccak256 hash to submit directly')
  .option('--calldata <calldata>', 'Calldata in hex format to calculate hash from')
  .option('--format <format>', 'Data format specifier', '1')
  .action(async (options) => {
    const { hash, calldata, format } = options;

    if (!hash && !calldata) {
      logger.error('Either --hash or --calldata must be provided');
      return;
    }

    if (hash && calldata) {
      logger.error('Cannot specify both --hash and --calldata');
      return;
    }

    let hashToSubmit: string;

    if (hash) {
      hashToSubmit = hash;
      logger.log('Using pre-calculated hash:', hashToSubmit);
    } else {
      if (!calldata.startsWith('0x')) {
        logger.error('Calldata must be in hex format starting with 0x');
        return;
      }

      const abiCoder = AbiCoder.defaultAbiCoder();
      const encoded = abiCoder.encode(['bytes', 'uint256'], [calldata, format]);
      hashToSubmit = keccak256(encoded);

      logger.log('Calculated hash from calldata:', hashToSubmit);
      logger.log('Calldata:', calldata);
      logger.log('Format:', format);
      logger.log('Encoded data:', encoded);
    }

    try {
      logger.log('Submitting hash to VEB contract...');
      logger.log('Hash to submit:', hashToSubmit);
      logger.log('Contract address:', exitBusOracleContract.target);

      const tx = await exitBusOracleContract.submitExitRequestsHash(hashToSubmit);
      logger.log('Transaction hash:', tx.hash);

      logger.log('Waiting for transaction confirmation...');
      const receipt = await tx.wait();

      if (receipt.status === 1) {
        logger.log('Hash submitted successfully!');
        logger.log('Transaction confirmed in block:', receipt.blockNumber);
      } else {
        logger.error('Transaction failed');
      }
    } catch (error) {
      logger.error('Failed to submit hash:', error);
    }
  });

oracle
  .command('submit-data')
  .description('Submit Exit Request Data')
  .option(
    '--data <data>',
    'Exit requests data in format: moduleId,nodeOpId,valIndex,pubkey;moduleId,nodeOpId,valIndex,pubkey',
  )
  .option('--calldata <calldata>', 'Exit requests calldata in hex format')
  .option('--format <format>', 'Data format specifier', '1')
  .action(async (options) => {
    const { data, calldata, format } = options;

    if (!data && !calldata) {
      logger.error('Either --data or --calldata must be provided');
      logger.log('Examples:');
      logger.log('  # Using CSV format:');
      logger.log('  ./run.sh vebo submit-data --data "1,15,12345,0x...;2,22,54321,0x..."');
      logger.log('  # Using hex calldata:');
      logger.log('  ./run.sh vebo submit-data --calldata 0x... --format 1');
      return;
    }

    if (data && calldata) {
      logger.error('Cannot specify both --data and --calldata');
      return;
    }

    try {
      let encodedData: string;

      if (data) {
        // Mode 1: Parse CSV format data
        const requests = data
          .split(';')
          .filter((req: string) => req.trim())
          .map((request: string) => {
            const parts = request.trim().split(',');
            if (parts.length !== 4) {
              throw new Error(`Invalid request format: ${request}. Expected: moduleId,nodeOpId,valIndex,pubkey`);
            }

            const [moduleId, nodeOpId, valIndex, pubkey] = parts;

            if (!moduleId || !nodeOpId || !valIndex || !pubkey) {
              throw new Error(`Invalid request format: ${request}. All fields are required`);
            }

            if (!pubkey.startsWith('0x') || pubkey.length !== 98) {
              throw new Error(`Invalid pubkey format: ${pubkey}. Expected 0x-prefixed 48-byte hex string`);
            }

            return {
              moduleId: parseInt(moduleId, 10),
              nodeOpId: parseInt(nodeOpId, 10),
              valIndex: parseInt(valIndex, 10),
              pubkey: pubkey.toLowerCase(),
            };
          });

        if (requests.length === 0) {
          logger.error('No valid exit requests found in data');
          return;
        }

        logger.log(`Parsed ${requests.length} exit request(s):`);
        requests.forEach((req: { moduleId: number; nodeOpId: number; valIndex: number; pubkey: string }, i: number) => {
          logger.log(
            `  ${i + 1}. Module ${req.moduleId}, Operator ${req.nodeOpId}, Index ${req.valIndex}, Pubkey ${req.pubkey}`,
          );
        });

        const encodeExitRequestHex = ({
          moduleId,
          nodeOpId,
          valIndex,
          pubkey,
        }: {
          moduleId: number;
          nodeOpId: number;
          valIndex: number;
          pubkey: string;
        }) => {
          const pubkeyHex = pubkey.slice(2);

          const moduleIdHex = moduleId.toString(16).padStart(6, '0'); // 3 bytes
          const nodeOpIdHex = nodeOpId.toString(16).padStart(10, '0'); // 5 bytes
          const valIndexHex = valIndex.toString(16).padStart(16, '0'); // 8 bytes

          return moduleIdHex + nodeOpIdHex + valIndexHex + pubkeyHex;
        };

        encodedData = '0x' + requests.map(encodeExitRequestHex).join('');
      } else {
        // Mode 2: Use provided calldata directly
        if (!calldata.startsWith('0x')) {
          logger.error('Calldata must be in hex format starting with 0x');
          return;
        }

        encodedData = calldata;

        // Calculate number of requests based on data length
        // Each request is 64 bytes (128 hex chars), plus 2 chars for '0x'
        const dataLength = (calldata.length - 2) / 2; // Convert hex string to byte length
        const requestCount = dataLength / 64;

        if (dataLength % 64 !== 0) {
          logger.error(
            `Invalid calldata length. Expected multiple of 64 bytes (128 hex chars), got ${dataLength} bytes`,
          );
          return;
        }

        logger.log(`Using provided calldata with ${requestCount} exit request(s)`);
        logger.log('Calldata:', calldata);
      }

      logger.log('Encoded data:', encodedData);
      logger.log('Data format:', format);

      const exitRequest = {
        dataFormat: parseInt(format, 10),
        data: encodedData,
      };

      logger.log('Submitting exit requests data to VEB contract...');
      logger.log('Contract address:', exitBusOracleContract.target);

      const tx = await exitBusOracleContract.submitExitRequestsData(exitRequest);
      logger.log('Transaction hash:', tx.hash);

      logger.log('Waiting for transaction confirmation...');
      const receipt = await tx.wait();

      if (receipt.status === 1) {
        logger.log('Exit requests data submitted successfully!');
        logger.log('Transaction confirmed in block:', receipt.blockNumber);
      } else {
        logger.error('Transaction failed');
      }
    } catch (error) {
      logger.error('Failed to submit exit requests data:', error);
    }
  });

oracle
  .command('trigger-exit')
  .description('Trigger a validator exit')
  .option('--tx <tx>', 'Transaction hash containing the reveal data')
  .option('--indexes <indexes>', 'Comma-separated list of validator indexes to exit (e.g., 0,1,2,3)')
  .option('--calldata <calldata>', 'Exit requests calldata in hex format')
  .option('--format <format>', 'Data format specifier', '1')
  .option('--value <value>', 'ETH value to send with transaction (e.g., 0.001)', '0.001')
  .action(async (options) => {
    const { tx, indexes, calldata, format, value } = options;

    if (!tx && !calldata) {
      logger.error('Either --tx or --calldata must be provided');
      logger.log('Examples:');
      logger.log('  # Using transaction hash:');
      logger.log('  ./run.sh vebo trigger-exit --tx 0x1234... --indexes 0,1,2,3 --value 0.001');
      logger.log('  # Using calldata:');
      logger.log('  ./run.sh vebo trigger-exit --calldata 0x1234... --format 1 --value 0.001');
      return;
    }

    if (tx && calldata) {
      logger.error('Cannot specify both --tx and --calldata');
      return;
    }

    if (tx && !indexes) {
      logger.error('--indexes parameter is required when using --tx');
      return;
    }

    try {
      let exitRequestData: { data: string; dataFormat: number };
      let exitDataIndexes: number[];

      if (tx) {
        // Mode 1: Fetch transaction data and use specific indexes
        logger.log('Fetching transaction data for:', tx);

        const transaction = await provider.getTransaction(tx);
        if (!transaction) {
          logger.error('Transaction not found:', tx);
          return;
        }

        // Parse transaction data - this should be a submitExitRequestsData call
        if (!transaction.data) {
          logger.error('Transaction has no data');
          return;
        }

        // Decode the transaction data to extract exit request data
        const abiCoder = AbiCoder.defaultAbiCoder();
        try {
          // Remove function selector (first 4 bytes)
          const callDataWithoutSelector = '0x' + transaction.data.slice(10);

          // Decode as (exitRequestData, version) where exitRequestData is (dataFormat, data)
          const decoded = abiCoder.decode(['(uint256,bytes)', 'uint256'], callDataWithoutSelector);

          exitRequestData = {
            dataFormat: Number(decoded[0][0]),
            data: decoded[0][1],
          };

          logger.log('Extracted exit request data from transaction');
          logger.log('Data format:', exitRequestData.dataFormat);
          logger.log('Data length:', exitRequestData.data.length);
        } catch (decodeError) {
          logger.error(
            'Failed to decode transaction data:',
            decodeError instanceof Error ? decodeError.message : decodeError,
          );
          return;
        }

        exitDataIndexes = indexes.split(',').map((idx: string) => parseInt(idx.trim(), 10));
        if (exitDataIndexes.some(isNaN)) {
          logger.error('Invalid indexes format. Use comma-separated numbers like: 0,1,2,3');
          return;
        }

        logger.log('Validator indexes to exit:', exitDataIndexes);
      } else {
        // Mode 2: Use provided calldata directly
        if (!calldata.startsWith('0x')) {
          logger.error('Calldata must be in hex format starting with 0x');
          return;
        }

        exitRequestData = {
          dataFormat: parseInt(format, 10),
          data: calldata,
        };

        // For calldata mode, we'll exit all validators in the data
        // Calculate number of validators based on data length
        // Each validator record is 64 bytes (3+5+8+48 bytes = 64 bytes)
        const dataWithoutPrefix = calldata.slice(2);
        const validatorCount = Math.floor(dataWithoutPrefix.length / (64 * 2)); // 2 hex chars per byte
        exitDataIndexes = Array.from({ length: validatorCount }, (_, i) => i);

        logger.log('Using provided calldata');
        logger.log('Data format:', exitRequestData.dataFormat);
        logger.log('Calculated validator count:', validatorCount);
        logger.log('Will exit all validators:', exitDataIndexes);
      }

      // Validate indexes array is sorted and unique
      const sortedIndexes = [...exitDataIndexes].sort((a, b) => a - b);
      if (!exitDataIndexes.every((val, i) => val === sortedIndexes[i])) {
        logger.error('Indexes must be sorted in ascending order and unique');
        return;
      }

      const ethValue = parseEther(value);
      logger.log('ETH value to send:', value, 'ETH');

      logger.log('Triggering exits...');
      logger.log('Exit request data format:', exitRequestData.dataFormat);
      logger.log('Exit request data:', exitRequestData.data.slice(0, 66) + '...');
      logger.log('Validator indexes:', exitDataIndexes);
      logger.log('Contract address:', exitBusOracleContract.target);

      const txResult = await exitBusOracleContract.triggerExits(
        exitRequestData,
        exitDataIndexes,
        ethers.ZeroAddress, // refund recipient (zero address means sender)
        { value: ethValue },
      );

      logger.log('Transaction hash:', txResult.hash);
      logger.log('Waiting for transaction confirmation...');

      const receipt = await txResult.wait();

      if (receipt.status === 1) {
        logger.log('Validator exits triggered successfully!');
        logger.log('Transaction confirmed in block:', receipt.blockNumber);
      } else {
        logger.error('Transaction failed');
      }
    } catch (error) {
      logger.error('Failed to trigger validator exits:', error);
    }
  });

oracle
  .command('set-limits')
  .description('Set exit request limits on VEB contract')
  .option('--max-exit-requests-limit <limit>', 'Maximum exit requests limit')
  .option('--exits-per-frame <exits>', 'Number of exits per frame')
  .option('--frame-duration <duration>', 'Frame duration in seconds')
  .action(async (options) => {
    const { maxExitRequestsLimit, exitsPerFrame, frameDuration } = options;

    if (!maxExitRequestsLimit || !exitsPerFrame || !frameDuration) {
      logger.error('All parameters are required: --max-exit-requests-limit, --exits-per-frame, --frame-duration');
      logger.log('Example usage:');
      logger.log('  ./run.sh vebo set-limits --max-exit-requests-limit 11200 --exits-per-frame 1 --frame-duration 48');
      return;
    }

    try {
      const maxLimit = parseInt(maxExitRequestsLimit, 10);
      const exitsCount = parseInt(exitsPerFrame, 10);
      const durationSec = parseInt(frameDuration, 10);

      if (isNaN(maxLimit) || isNaN(exitsCount) || isNaN(durationSec)) {
        logger.error('All parameters must be valid numbers');
        return;
      }

      if (maxLimit <= 0 || exitsCount <= 0 || durationSec <= 0) {
        logger.error('All parameters must be positive numbers');
        return;
      }

      logger.log('Setting exit request limits on VEB contract...');
      logger.log('Parameters:');
      logger.log(`  Max Exit Requests Limit: ${maxLimit}`);
      logger.log(`  Exits Per Frame: ${exitsCount}`);
      logger.log(`  Frame Duration: ${durationSec} seconds`);
      logger.log('Contract address:', exitBusOracleContract.target);

      const tx = await exitBusOracleContract.setExitRequestLimit(maxLimit, exitsCount, durationSec);
      logger.log('Transaction hash:', tx.hash);

      logger.log('Waiting for transaction confirmation...');
      const receipt = await tx.wait();

      if (receipt.status === 1) {
        logger.log('Exit request limits set successfully!');
        logger.log('Transaction confirmed in block:', receipt.blockNumber);
      } else {
        logger.error('Transaction failed');
      }
    } catch (error) {
      logger.error('Failed to set exit request limits:', error);
    }
  });

oracle
  .command('get-limits')
  .description('Get current exit request limits from VEB contract')
  .action(async () => {
    try {
      logger.log('Retrieving current exit limits from VEB contract...');
      logger.log('Contract address:', exitBusOracleContract.target);

      const limitsInfo = await exitBusOracleContract.getExitRequestLimitFullInfo();

      const [maxExitRequestsLimit, exitsPerFrame, frameDurationInSec, prevExitRequestsLimit, currentExitRequestsLimit] =
        limitsInfo;

      logger.log('');
      logger.log('Current Exit Request Limits:');
      logger.log(`max-exit-requests-limit: ${maxExitRequestsLimit}`);
      logger.log(`exits-per-frame: ${exitsPerFrame}`);
      logger.log(`frame-duration: ${frameDurationInSec}`);
      logger.log('');
      logger.log('Additional Info:');
      logger.log(`prev-exit-requests-limit: ${prevExitRequestsLimit}`);
      logger.log(`current-exit-requests-limit: ${currentExitRequestsLimit}`);
    } catch (error) {
      logger.error('Failed to retrieve exit request limits:', error);
    }
  });
