import { program } from '@command';
import { aclContract, simpleDVTContract } from '@contracts';
import { addAragonAppSubCommands, addCuratedModuleSubCommands, addLogsCommands, addParsingCommands } from './common';
import { getLatestBlock, logger } from '@utils';
import { EventLog } from 'ethers';

const simpleDVT = program.command('simple-dvt').description('interact with simple dvt module contract');
addAragonAppSubCommands(simpleDVT, simpleDVTContract);
addParsingCommands(simpleDVT, simpleDVTContract);
addLogsCommands(simpleDVT, simpleDVTContract);
addCuratedModuleSubCommands(simpleDVT, simpleDVTContract);

simpleDVT
  .command('manager-addresses')
  .description('returns manager addresses list')
  .option('-b, --blocks <number>', 'blocks', '1000000')
  .action(async (options) => {
    const { blocks } = options;
    const simpleDVTAddress = await simpleDVTContract.getAddress();
    const role = await simpleDVTContract.MANAGE_SIGNING_KEYS();

    const latestBlock = await getLatestBlock();
    const toBlock = latestBlock.number;
    const fromBlock = Math.max(toBlock - Number(blocks), 0);

    const filter = aclContract.filters.SetPermission(null, simpleDVTAddress, role);
    const logs = await aclContract.queryFilter(filter, fromBlock, toBlock);

    const result = await Promise.all(
      logs.map(async (log) => {
        if (!(log instanceof EventLog)) throw new Error('Log is not an EventLog');

        try {
          const managerAddress = log.args[0];
          const roleParams = await aclContract.getPermissionParam(managerAddress, simpleDVTAddress, role, 0);

          const [, , operatorId] = roleParams;

          return { operatorId, managerAddress };
        } catch {
          // ignore if role has no params
        }
      }),
    );

    logger.table(result.filter((v) => v));
  });
