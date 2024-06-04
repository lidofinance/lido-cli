import { locatorContract, stakingRouterAddress } from '@contracts';
import { provider } from '@providers';
import { encodeFromAgent, votingNewVote } from '@scripts';
import { CallScriptAction, encodeCallScript, forwardVoteFromTm, getRoleHash } from '@utils';
import { Contract, Interface } from 'ethers';

const LOCATOR_IMPLEMENTAION = '0xD141C08fD5355b4db880C7a23209ec6b0455f140';

const OLD_DSM = '0xB8ae82F7BFF2553bAF158B7a911DC10162045C53';
const NEW_DSM = '0xe009CC787AdF692526d93AA12a37935fEcAD5ee0';

export const upgradeDSM = async () => {
  const iface = new Interface([
    'function revokeRole(bytes32,address)',
    'function proxy__upgradeTo(address)',
    'function grantRole(bytes32,address)',
    'function STAKING_MODULE_UNVETTING_ROLE() view returns (bytes32)',
  ]);

  // 1. Update locator implementation
  const locatorProxyAddress = await locatorContract.getAddress();
  const [, locatorScript] = encodeFromAgent({
    to: locatorProxyAddress,
    data: iface.encodeFunctionData('proxy__upgradeTo', [LOCATOR_IMPLEMENTAION]),
  });

  // 2. Revoke unvetting role from old DSM
  const stakingRouterImplContract = new Contract(stakingRouterAddress, iface, provider);
  const unvettingRoleHash = await getRoleHash(stakingRouterImplContract, 'STAKING_MODULE_UNVETTING_ROLE');
  const [, resumeRoleRevokeScript] = encodeFromAgent({
    to: stakingRouterAddress,
    data: iface.encodeFunctionData('revokeRole', [unvettingRoleHash, OLD_DSM]),
  });

  // 3. Grant unvetting role to new DSM
  const [, unvettingRoleGrantScript] = encodeFromAgent({
    to: stakingRouterAddress,
    data: iface.encodeFunctionData('grantRole', [unvettingRoleHash, NEW_DSM]),
  });

  // Collect all calls
  const calls: CallScriptAction[] = [locatorScript, resumeRoleRevokeScript, unvettingRoleGrantScript];

  const description = [
    `1. Update locator implementation to ${LOCATOR_IMPLEMENTAION} with new DSM ${NEW_DSM}`,
    `2. Revoke unvetting role from old DSM ${OLD_DSM}`,
    `3. Grant unvetting role to new DSM ${NEW_DSM}`,
  ].join('\n');

  const voteEvmScript = encodeCallScript(calls);
  const [newVoteCalldata] = votingNewVote(voteEvmScript, description);

  await forwardVoteFromTm(newVoteCalldata);
};
