import {
  getAppProxyContract,
  locatorContract,
  norAddress,
  stakingRouterAddress,
  stakingRouterContract,
} from '@contracts';
import { provider } from '@providers';
import { encodeFromAgent, updateAragonApp, votingNewVote } from '@scripts';
import { CallScriptAction, encodeCallScript, forwardVoteFromTm, getRoleHash } from '@utils';
import { Contract, Interface } from 'ethers';

const LOCATOR_IMPLEMENTAION = '0xa12Fd7c4c75D78E208B203EDc96053E33BdBFab8';

const OLD_DSM = '0x336c1efd15284104a04e705f430e4d4a7fc2c6c1';
const NEW_DSM = '0xb8ae82f7bff2553baf158b7a911dc10162045c53';

const STAKING_ROUTER_IMPLEMENTATION = '0xb1867e93aea81975cf11b8415ccd70e9b07e09a6';

const NOR_IMPLEMENTATION = '0x287278aaac35e5e52b0f7266872139812d32679b';
const NOR_CONTENT_URI =
  '0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
const NOR_VERSION = ['2', '0', '0'];

const PRIORITY_EXIT_SHARE_THRESHOLDS_BP = [10_000];

export const stakingRouterV2 = async () => {
  const iface = new Interface([
    'function finalizeUpgrade_v2(uint256[])',
    'function proxy__upgradeTo(address)',
    'function revokeRole(bytes32,address)',
    'function grantRole(bytes32,address)',
    'function STAKING_MODULE_UNVETTING_ROLE() view returns (bytes32)',
  ]);

  // 1. Update locator implementation
  const locatorProxyAddress = await locatorContract.getAddress();
  const [, locatorScript] = encodeFromAgent({
    to: locatorProxyAddress,
    data: iface.encodeFunctionData('proxy__upgradeTo', [LOCATOR_IMPLEMENTAION]),
  });

  // 2. Revoke pause role from old DSM
  const pauseRoleHash = await getRoleHash(stakingRouterContract, 'STAKING_MODULE_PAUSE_ROLE');
  const [, pauseRoleRevokeScript] = encodeFromAgent({
    to: stakingRouterAddress,
    data: iface.encodeFunctionData('revokeRole', [pauseRoleHash, OLD_DSM]),
  });

  // 3. Revoke resume role from old DSM
  const resumeRoleHash = await getRoleHash(stakingRouterContract, 'STAKING_MODULE_RESUME_ROLE');
  const [, resumeRoleRevokeScript] = encodeFromAgent({
    to: stakingRouterAddress,
    data: iface.encodeFunctionData('revokeRole', [resumeRoleHash, OLD_DSM]),
  });

  // 4. Grant unvetting role to new DSM
  const stakingRouterImplContract = new Contract(STAKING_ROUTER_IMPLEMENTATION, iface, provider);
  const unvettingRoleHash = await getRoleHash(stakingRouterImplContract, 'STAKING_MODULE_UNVETTING_ROLE');
  const [, unvettingRoleGrantScript] = encodeFromAgent({
    to: stakingRouterAddress,
    data: iface.encodeFunctionData('grantRole', [unvettingRoleHash, NEW_DSM]),
  });

  // 5. Update staking router implementation
  const [, stakingRouterUpdateScript] = encodeFromAgent({
    to: stakingRouterAddress,
    data: iface.encodeFunctionData('proxy__upgradeTo', [STAKING_ROUTER_IMPLEMENTATION]),
  });

  // 6. Call finalize upgrade on Staking Router
  const stakingRouterFinalizeScript: CallScriptAction = {
    to: stakingRouterAddress,
    data: iface.encodeFunctionData('finalizeUpgrade_v2', [PRIORITY_EXIT_SHARE_THRESHOLDS_BP]),
  };

  // 7, 8. Update NOR implementation
  const norProxyContract = getAppProxyContract(async () => norAddress);
  const norAppId = await norProxyContract.appId();
  const [, norNewVersionCall, norSetAppCall] = await updateAragonApp(
    NOR_VERSION,
    NOR_IMPLEMENTATION,
    NOR_CONTENT_URI,
    norAppId,
  );

  // Collect all calls
  const calls: CallScriptAction[] = [
    locatorScript,
    pauseRoleRevokeScript,
    resumeRoleRevokeScript,
    unvettingRoleGrantScript,
    stakingRouterUpdateScript,
    stakingRouterFinalizeScript,
    norNewVersionCall,
    norSetAppCall,
  ];

  const description = [
    `1. Update locator implementation to ${LOCATOR_IMPLEMENTAION} with new DSM ${NEW_DSM}`,
    `2. Revoke pause role from old DSM ${OLD_DSM}`,
    `3. Revoke resume role from old DSM ${OLD_DSM}`,
    `4. Grant unvetting role to new DSM ${NEW_DSM}`,
    `5. Update staking router implementation to ${STAKING_ROUTER_IMPLEMENTATION}`,
    `6. Finalize upgrade with priority exit share thresholds: ${PRIORITY_EXIT_SHARE_THRESHOLDS_BP}`,
    `7. Create new NOR version with address ${NOR_IMPLEMENTATION}`,
    `8. Update NOR app to new version`,
  ].join('\n');

  const voteEvmScript = encodeCallScript(calls);
  const [newVoteCalldata] = votingNewVote(voteEvmScript, description);

  await forwardVoteFromTm(newVoteCalldata);
};
