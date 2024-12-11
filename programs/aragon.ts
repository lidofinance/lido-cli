import { program } from '@command';
import { getConfigValue } from '@configs';
import { kernelContract } from '@contracts';
import { contractCallTxWithConfirm } from '@utils';
import { namehash } from 'ethers';

const aragon = program.command('aragon').description('interact with aragon contracts');

aragon
  .command('deploy-app-proxy')
  .aliases(['deploy-proxy'])
  .description('deploy a proxy contract')
  .argument('<app-name>', 'name of the app')
  .action(async (appName) => {
    const apmEnsName = getConfigValue('lidoApmEnsName');
    const appFullName = `${appName}.${apmEnsName}`;
    const appId = namehash(appFullName);
    const kernelAddress = await kernelContract.getAddress();

    await contractCallTxWithConfirm(kernelContract, 'newAppProxy(address,bytes32)', [kernelAddress, appId]);
  });
