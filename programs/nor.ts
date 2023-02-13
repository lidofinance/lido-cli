import { program } from '../command';
import { norContract } from '../contracts';
import { addAragonAppSubCommands } from './common';

const nor = program.command('nor');
addAragonAppSubCommands(nor, norContract);

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
  });
