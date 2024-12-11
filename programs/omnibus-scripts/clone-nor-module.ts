import { getConfigValue } from '@configs';
import {
  aclContract,
  aragonAgentAddress,
  burnerAddress,
  burnerContract,
  kernelContract,
  lidoApmAddress,
  lidoApmContract,
  locatorAddress,
  norAddress,
  norContract,
  stakingRouterAddress,
  stakingRouterContract,
  votingAddress,
} from '@contracts';
import { encodeFromAgent, votingNewVote } from '@scripts';
import { CallScriptActionWithDescription, encodeCallScript, forwardVoteFromTm, getRoleHash } from '@utils';
import { Contract, Interface, namehash } from 'ethers';
import { joinVotingDesc } from './generators';
import { wallet } from '@providers';

const VERSION = [1, 0, 0];
const CONTENT_URI = '0x' + '00'.repeat(51);
const APP_NAME = 'simple-dvt';

const MODULE_NAME = 'SimpleDVT';
const TARGET_SHARE = 10_000; // 100%
const MODULE_FEE = 800; // 8%
const TREASURY_FEE = 200; // 2%

// Use `aragon deploy-proxy <APP_NAME>` for deployment
const APP_PROXY_ADDRESS = '0xD4b2843eAB523a2531b25697A1c74b1acB848619';

export const cloneNorModule = async () => {
  const aragonProxyIface = new Interface(['function implementation() external view returns (address)']);
  const norProxyContract = new Contract(norAddress, aragonProxyIface, wallet);

  const implementation = await norProxyContract.implementation();
  const apmEnsName = getConfigValue('lidoApmEnsName');
  const appFullName = `${APP_NAME}.${apmEnsName}`;
  const appId = namehash(appFullName);
  const appProxyContract = (await norContract.attach(APP_PROXY_ADDRESS)) as Contract;

  // 1. New repo with version
  const newRepoWithVersionScript: CallScriptActionWithDescription = {
    to: lidoApmAddress,
    data: lidoApmContract.interface.encodeFunctionData('newRepoWithVersion', [
      APP_NAME,
      votingAddress,
      VERSION,
      implementation,
      CONTENT_URI,
    ]),
    desc: `Create a new repo with version ${VERSION.join('.')} for ${APP_NAME}`,
  };

  // 2. Link appId with implementation
  const appBasesNamespace = await kernelContract.APP_BASES_NAMESPACE();
  const linkAppIdScript: CallScriptActionWithDescription = {
    to: await kernelContract.getAddress(),
    data: kernelContract.interface.encodeFunctionData('setApp', [appBasesNamespace, appId, implementation]),
    desc: `Link ${appId} with the implementation ${implementation}`,
  };

  // 3. Initialize
  const moduleType = await norContract.getType();
  const stuckPenaltyDelay = await norContract.getStuckPenaltyDelay();
  const initializeScript: CallScriptActionWithDescription = {
    to: APP_PROXY_ADDRESS,
    data: appProxyContract.interface.encodeFunctionData('initialize', [locatorAddress, moduleType, stuckPenaltyDelay]),
    desc: 'Initialize the new module',
  };

  // 4. Grant staking router permission
  const stakingRouterRole = await getRoleHash(norContract, 'STAKING_ROUTER_ROLE');
  const stakingRouterPermissionScript: CallScriptActionWithDescription = {
    to: await aclContract.getAddress(),
    data: aclContract.interface.encodeFunctionData('createPermission', [
      stakingRouterAddress,
      APP_PROXY_ADDRESS,
      stakingRouterRole,
      votingAddress,
    ]),
    desc: 'Grant STAKING_ROUTER_ROLE permission to the new module',
  };

  // 5. Grant burn shares role
  const burnSharesRoleHash = await getRoleHash(burnerContract, 'REQUEST_BURN_SHARES_ROLE');
  const [, burnSharesPermissionScript] = encodeFromAgent({
    to: burnerAddress,
    data: burnerContract.interface.encodeFunctionData('grantRole', [burnSharesRoleHash, APP_PROXY_ADDRESS]),
    desc: 'Grant REQUEST_BURN_SHARES_ROLE role to the new module',
  });

  // 6. Grant staking router manage role
  const stakingRouterManageRoleHash = await getRoleHash(stakingRouterContract, 'STAKING_MODULE_MANAGE_ROLE');
  const [, stakingRouterManageRoleScript] = encodeFromAgent({
    to: stakingRouterAddress,
    data: stakingRouterContract.interface.encodeFunctionData('grantRole', [
      stakingRouterManageRoleHash,
      aragonAgentAddress,
    ]),
    desc: 'Grant STAKING_MODULE_MANAGE_ROLE role to the Agent',
  });

  // 7. Add module to router
  const stakingRouterIface = new Interface(['function addStakingModule(string,address,uint256,uint256,uint256)']);
  const [, addModuleScript] = encodeFromAgent({
    to: stakingRouterAddress,
    data: stakingRouterIface.encodeFunctionData('addStakingModule', [
      MODULE_NAME,
      APP_PROXY_ADDRESS,
      TARGET_SHARE,
      MODULE_FEE,
      TREASURY_FEE,
    ]),
    desc: 'Add the new module to the staking router',
  });

  const calls: CallScriptActionWithDescription[] = [
    newRepoWithVersionScript,
    linkAppIdScript,
    initializeScript,
    stakingRouterPermissionScript,
    burnSharesPermissionScript,
    stakingRouterManageRoleScript,
    addModuleScript,
  ];

  const description = joinVotingDesc(calls);
  const voteEvmScript = encodeCallScript(calls);
  const [newVoteCalldata] = votingNewVote(voteEvmScript, description);

  await forwardVoteFromTm(newVoteCalldata);
};
