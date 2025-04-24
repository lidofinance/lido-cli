import { program } from '@command';
import { logger } from '@utils';
import { validatorExitVerifierContract } from '@contracts';

const verifier = program
  .command('validator-exit-verifier')
  .aliases(['exit-verifier', 'vev'])
  .description('ValidatorExitVerifier contract commands');

verifier
  .command('verify-active')
  .description('Verifies that provided validators are still active at the given beacon block.')
  .requiredOption('--beacon-block <json>', 'JSON with ProvableBeaconBlockHeader data')
  .requiredOption('--validator-witnesses <json>', 'JSON with ValidatorWitness[] data')
  .requiredOption('--exit-requests <json>', 'JSON with ExitRequestData')
  .action(async (options) => {
    try {
      const beaconBlock = JSON.parse(options.beaconBlock);
      const validatorWitnesses = JSON.parse(options.validatorWitnesses);
      const exitRequests = JSON.parse(options.exitRequests);

      await validatorExitVerifierContract.verifyActiveValidatorsAfterExitRequest(
        beaconBlock,
        validatorWitnesses,
        exitRequests,
      );

      logger.log('Verification of active validators done.');
    } catch (error) {
      logger.error(error);
    }
  });

verifier
  .command('verify-historical')
  .description('Verifies historical blocks and checks that certain validators remain active.')
  .requiredOption('--beacon-block <json>', 'JSON with ProvableBeaconBlockHeader data')
  .requiredOption('--old-block <json>', 'JSON with HistoricalHeaderWitness')
  .requiredOption('--validator-witnesses <json>', 'JSON with ValidatorWitness[] data')
  .requiredOption('--exit-requests <json>', 'JSON with ExitRequestData')
  .action(async (options) => {
    try {
      const beaconBlock = JSON.parse(options.beaconBlock);
      const oldBlock = JSON.parse(options.oldBlock);
      const validatorWitnesses = JSON.parse(options.validatorWitnesses);
      const exitRequests = JSON.parse(options.exitRequests);

      await validatorExitVerifierContract.verifyHistoricalActiveValidatorsAfterExitRequest(
        beaconBlock,
        oldBlock,
        validatorWitnesses,
        exitRequests,
      );

      logger.log('Historical verification done.');
    } catch (error) {
      logger.error(error);
    }
  });
