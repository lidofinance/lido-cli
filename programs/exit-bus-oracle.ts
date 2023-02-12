import { program } from '../command';
import { exitBusOracleContract, consensusForExitBusContract } from '../contracts';

const oracle = program.command('exit-bus-oracle');

oracle.command('members').action(async () => {
  const [addresses, lastReportedSlots] = await consensusForExitBusContract.getMembers();

  console.log('addresses', [...addresses]);
  console.log('last reported slots', [...lastReportedSlots]);
});

oracle.command('quorum').action(async () => {
  const quorum = await consensusForExitBusContract.getQuorum();
  console.log('quorum', Number(quorum));
});

oracle
  .command('add-member')
  .option('-a, --address <string>', 'address')
  .option('-q, --quorum <string>', 'quorum')
  .action(async (options) => {
    const { address, quorum } = options;
    await consensusForExitBusContract.addMember(address, quorum);
  });

oracle
  .command('remove-member')
  .option('-a, --address <string>', 'address')
  .action(async (options) => {
    const { address } = options;
    await consensusForExitBusContract.removeMember(address);
  });

oracle
  .command('call')
  .argument('<string>', 'method name')
  .action(async (method) => {
    const result = await exitBusOracleContract[method]();
    console.log('result', result);
  });

oracle
  .command('consensus-call')
  .argument('<string>', 'method name')
  .action(async (method) => {
    const result = await consensusForExitBusContract[method]();
    console.log('result', result);
  });

oracle
  .command('consensus-grant-role')
  .option('-r, --role <string>', 'role')
  .option('-a, --address <string>', 'address')
  .action(async (options) => {
    const { role, address } = options;
    await consensusForExitBusContract.grantRole(role, address);
  });

oracle
  .command('consensus-revoke-role')
  .option('-r, --role <string>', 'role')
  .option('-a, --address <string>', 'address')
  .action(async (options) => {
    const { role, address } = options;
    await consensusForExitBusContract.revokeRole(role, address);
  });

oracle
  .command('grant-role')
  .option('-r, --role <string>', 'role')
  .option('-a, --address <string>', 'address')
  .action(async (options) => {
    const { role, address } = options;
    await exitBusOracleContract.grantRole(role, address);
  });

oracle
  .command('revoke-role')
  .option('-r, --role <string>', 'role')
  .option('-a, --address <string>', 'address')
  .action(async (options) => {
    const { role, address } = options;
    await exitBusOracleContract.revokeRole(role, address);
  });

oracle
  .command('frame-config')
  .option('-e, --epochs-per-frame <number>', 'epochs per frame')
  .option('-f, --fastlane <string>', 'fastlane length slots')
  .action(async (options) => {
    const { epochsPerFrame, fastlane } = options;
    await consensusForExitBusContract.setFrameConfig(epochsPerFrame, fastlane);
  });

oracle
  .command('decode-calldata')
  .argument('<calldata>')
  .action(async (calldata) => {
    const result = exitBusOracleContract.interface.decodeFunctionData(calldata.slice(0, 10), calldata);
    console.log(result);
  });

oracle
  .command('parse-error')
  .argument('<data>')
  .action(async (errorData) => {
    const result = exitBusOracleContract.interface.parseError(errorData);
    console.log(result);
  });
