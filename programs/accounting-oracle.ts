import { program } from '../command';
import { accountingOracleContract, consensusForAccountingContract } from '../contracts';

const oracle = program.command('accounting-oracle');

oracle.command('members').action(async () => {
  const [addresses, lastReportedSlots] = await consensusForAccountingContract.getMembers();

  console.log('addresses', [...addresses]);
  console.log('last reported slots', [...lastReportedSlots]);
});

oracle.command('quorum').action(async () => {
  const quorum = await consensusForAccountingContract.getQuorum();
  console.log('quorum', Number(quorum));
});

oracle
  .command('consensus-state')
  .option('-a, --address <string>', 'address')
  .action(async (options) => {
    const { address } = options;
    const state = await consensusForAccountingContract.getConsensusStateForMember(address);
    console.log('state', state);
  });

oracle
  .command('add-member')
  .option('-a, --address <string>', 'address')
  .option('-q, --quorum <string>', 'quorum')
  .action(async (options) => {
    const { address, quorum } = options;
    await consensusForAccountingContract.addMember(address, quorum);
  });

oracle
  .command('remove-member')
  .option('-a, --address <string>', 'address')
  .action(async (options) => {
    const { address } = options;
    await consensusForAccountingContract.removeMember(address);
  });

oracle
  .command('call')
  .argument('<string>', 'method name')
  .action(async (method) => {
    const result = await accountingOracleContract[method]();
    console.log('result', result);
  });

oracle
  .command('consensus-call')
  .argument('<string>', 'method name')
  .action(async (method) => {
    const result = await consensusForAccountingContract[method]();
    console.log('result', result);
  });

oracle
  .command('consensus-grant-role')
  .option('-r, --role <string>', 'role')
  .option('-a, --address <string>', 'address')
  .action(async (options) => {
    const { role, address } = options;
    await consensusForAccountingContract.grantRole(role, address);
  });

oracle
  .command('consensus-revoke-role')
  .option('-r, --role <string>', 'role')
  .option('-a, --address <string>', 'address')
  .action(async (options) => {
    const { role, address } = options;
    await consensusForAccountingContract.revokeRole(role, address);
  });

oracle
  .command('grant-role')
  .option('-r, --role <string>', 'role')
  .option('-a, --address <string>', 'address')
  .action(async (options) => {
    const { role, address } = options;
    await accountingOracleContract.grantRole(role, address);
  });

oracle
  .command('revoke-role')
  .option('-r, --role <string>', 'role')
  .option('-a, --address <string>', 'address')
  .action(async (options) => {
    const { role, address } = options;
    await accountingOracleContract.revokeRole(role, address);
  });

oracle
  .command('frame-config')
  .option('-e, --epochs-per-frame <number>', 'epochs per frame')
  .option('-f, --fastlane <string>', 'fastlane length slots')
  .action(async (options) => {
    const { epochsPerFrame, fastlane } = options;
    await consensusForAccountingContract.setFrameConfig(epochsPerFrame, fastlane);
  });

oracle
  .command('decode-calldata')
  .argument('<calldata>')
  .action(async (calldata) => {
    const result = accountingOracleContract.interface.decodeFunctionData(calldata.slice(0, 10), calldata);
    console.log(result);
  });

oracle
  .command('parse-error')
  .argument('<data>')
  .action(async (errorData) => {
    const result = accountingOracleContract.interface.parseError(errorData);
    console.log(result);
  });
