import { program } from '../command';
import { norContract } from '../contracts';
import { addAragonAppSubCommands, addParsingCommands } from './common';

const nor = program.command('nor');
addAragonAppSubCommands(nor, norContract);
addParsingCommands(nor, norContract);

nor.command('operators').action(async () => {
  const total = await norContract.getNodeOperatorsCount();
  console.log('total', total);
});

nor
  .command('get-operator')
  .argument('<number>', 'operator id')
  .action(async (operatorId) => {
    const operator = await norContract.getNodeOperator(operatorId, true);
    console.log('operator', operator);
  });

nor
  .command('get-operator-summary')
  .argument('<number>', 'operator id')
  .action(async (operatorId) => {
    const summary = await norContract.getNodeOperatorSummary(operatorId);
    console.log('operator summary', summary);
  });

nor
  .command('add-operator')
  .option('-n, --name <string>', 'operator name')
  .option('-a, --address <string>', 'reward address')
  .action(async (options) => {
    const { name, address } = options;
    await norContract.addNodeOperator(name, address);
    console.log('operator added');
  });

nor
  .command('add-key')
  .option('-o, --operator-id <number>', 'node operator id')
  .option('-c, --count <number>', 'keys count')
  .option('-p, --public-keys <string>', 'public keys')
  .option('-s, --signatures <string>', 'signatures')
  .action(async (options) => {
    const { operatorId, count, publicKeys, signatures } = options;
    await norContract.addSigningKeys(operatorId, count, publicKeys, signatures);
    console.log('key added');
  });

nor
  .command('set-limit')
  .option('-o, --operator-id <number>', 'node operator id')
  .option('-l, --limit <number>', 'staking limit')
  .action(async (options) => {
    const { operatorId, limit } = options;
    await norContract.setNodeOperatorStakingLimit(operatorId, limit);
    console.log('limit is set');
  });
