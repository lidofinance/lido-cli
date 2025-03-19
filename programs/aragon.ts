import { program } from '@command';
import { getConfigValue } from '@configs';
import { ensContract, getAppProxyContract, getPublicResolverContract, kernelContract } from '@contracts';
import { contractCallTxWithConfirm, logger } from '@utils';
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

aragon
  .command('repo')
  .description('returns the repo address')
  .argument('<address>', 'address')
  .action(async (address) => {
    const proxyContract = getAppProxyContract(async () => address);
    const appId = await proxyContract.appId();

    const getResolverAddress = () => ensContract.resolver(appId);
    const resolverContract = getPublicResolverContract(getResolverAddress);

    const getRepoAddress = () => resolverContract.addr(appId);
    const repoAddress = await getRepoAddress();

    logger.log('Repo address', repoAddress);
  });
