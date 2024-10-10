import { getAppProxyContract, norAddress, sandboxAddress, simpleDVTAddress } from '@contracts';
import { updateAragonApp, votingNewVote } from '@scripts';
import { CallScriptAction, encodeCallScript, forwardVoteFromTm } from '@utils';
import { concat, Interface } from 'ethers';

const NOR_IMPLEMENTATION = '0x41646708a7edbe22bd635cb838ff9c0cfa99a3be';
const NOR_CONTENT_URI = '0x' + '00'.repeat(51);

const NOR_VERSION = ['3', '0', '0'];
const SDVT_VERSION = ['3', '0', '0'];
const SANDBOX_VERSION = ['3', '0', '0'];

// Holesky testnet config
const EASYTRACK_ADDRESS = '0x1763b9ED3586B08AE796c7787811a2E1bc16163a';
const NEW_TARGET_LIMIT_FACTORY = '0x431a156BEba95803a95452441C1959c4479710e1';
const OLD_TARGET_LIMIT__FACTORY = '0xC91a676A69Eb49be9ECa1954fE6fc861AE07A9A2';

export const stakingRouterFix = async () => {
  const iface = new Interface([
    'function removeEVMScriptFactory(address)',
    'function addEVMScriptFactory(address,bytes)',
  ]);

  // 1, 2. Update NOR implementation
  const norProxyContract = getAppProxyContract(async () => norAddress);
  const norAppId = await norProxyContract.appId();
  const [, norNewVersionBumpScript, norSetAppScript] = await updateAragonApp(
    NOR_VERSION,
    NOR_IMPLEMENTATION,
    NOR_CONTENT_URI,
    norAppId,
  );

  // 3, 4. Update SDVT implementation
  const sdvtProxyContract = getAppProxyContract(async () => simpleDVTAddress);
  const sdvtAppId = await sdvtProxyContract.appId();
  const [, sdvtNewVersionBumpScript, sdvtSetAppScript] = await updateAragonApp(
    SDVT_VERSION,
    NOR_IMPLEMENTATION,
    NOR_CONTENT_URI,
    sdvtAppId,
  );

  // 5, 6. Update Sandbox implementation
  const sandboxProxyContract = getAppProxyContract(async () => sandboxAddress);
  const sandboxAppId = await sandboxProxyContract.appId();
  const [, sandboxNewVersionBumpScript, sandboxSetAppScript] = await updateAragonApp(
    SANDBOX_VERSION,
    NOR_IMPLEMENTATION,
    NOR_CONTENT_URI,
    sandboxAppId,
  );

  // 7. Remove old factory
  const removeTargetLimitFactoryToETScript: CallScriptAction = {
    to: EASYTRACK_ADDRESS,
    data: iface.encodeFunctionData('removeEVMScriptFactory', [OLD_TARGET_LIMIT__FACTORY]),
  };

  // 8. Add new factory
  const updateLimitIface = new Interface(['function updateTargetValidatorsLimits(uint256,uint256,uint256)']);
  const updateLimitSelector = updateLimitIface.getFunction('updateTargetValidatorsLimits')?.selector;
  if (!updateLimitSelector) throw new Error('updateLimitSelector not found');
  const factoryPermissions = concat([simpleDVTAddress, updateLimitSelector]);
  const addTargetLimitFactoryToETScript: CallScriptAction = {
    to: EASYTRACK_ADDRESS,
    data: iface.encodeFunctionData('addEVMScriptFactory', [NEW_TARGET_LIMIT_FACTORY, factoryPermissions]),
  };

  // Collect all calls
  const calls: CallScriptAction[] = [
    norNewVersionBumpScript,
    norSetAppScript,
    sdvtNewVersionBumpScript,
    sdvtSetAppScript,
    sandboxNewVersionBumpScript,
    sandboxSetAppScript,
    removeTargetLimitFactoryToETScript,
    addTargetLimitFactoryToETScript,
  ];

  const description = [
    `1. Create new NOR version with address ${NOR_IMPLEMENTATION}`,
    `2. Update NOR app to new version ${NOR_VERSION.join('.')}`,
    `3. Create new SDVT version with address ${NOR_IMPLEMENTATION}`,
    `4. Update SDVT app to new version ${SDVT_VERSION.join('.')}`,
    `5. Create new Sandbox version with address ${NOR_IMPLEMENTATION}`,
    `6. Update Sandbox app to new version ${SANDBOX_VERSION.join('.')}`,
    `7. Remove updateTargetValidatorsLimits with address ${OLD_TARGET_LIMIT__FACTORY} from EasyTrack`,
    `8. Add updateTargetValidatorsLimits with address ${NEW_TARGET_LIMIT_FACTORY} to EasyTrack`,
  ].join('\n');

  const voteEvmScript = encodeCallScript(calls);
  const [newVoteCalldata] = votingNewVote(voteEvmScript, description);

  await forwardVoteFromTm(newVoteCalldata);
};
