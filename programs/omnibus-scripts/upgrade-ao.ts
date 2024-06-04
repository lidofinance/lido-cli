import { accountingOracleAddress, getAppProxyContract, locatorContract, norAddress } from '@contracts';
import { encodeFromAgent, updateAragonApp, votingNewVote } from '@scripts';
import { CallScriptAction, encodeCallScript, forwardVoteFromTm } from '@utils';
import { Interface } from 'ethers';

const LOCATOR_IMPLEMENTAION = '0x3fb931564DD070cf6C89a3d1e95B9601F64f4C34';
const AO_IMPLEMENTATION = '0x6e99b6E2ccB4DfaeA9EaE7C6F7AC694bF45f90D1';

const NOR_IMPLEMENTATION = '0xc1bcf8fb7352751ba84754158b43347166f8cdfd';
const NOR_CONTENT_URI =
  '0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
const NOR_VERSION = ['3', '0', '0'];

export const accountingOracleV2 = async () => {
  const iface = new Interface([
    'function finalizeUpgrade_v2(uint256)',
    'function finalizeUpgrade_v3()',
    'function proxy__upgradeTo(address)',
  ]);

  // 1. Update locator implementation
  const locatorProxyAddress = await locatorContract.getAddress();
  const [, locatorScript] = encodeFromAgent({
    to: locatorProxyAddress,
    data: iface.encodeFunctionData('proxy__upgradeTo', [LOCATOR_IMPLEMENTAION]),
  });

  // 2. Update accounting oracle implementation
  const [, accountingOracleScript] = encodeFromAgent({
    to: accountingOracleAddress,
    data: iface.encodeFunctionData('proxy__upgradeTo', [AO_IMPLEMENTATION]),
  });

  // 3. Call finalize upgrade on Accounting Oracle
  const accountingOracleFinalizeScript: CallScriptAction = {
    to: accountingOracleAddress,
    data: iface.encodeFunctionData('finalizeUpgrade_v2', [2]),
  };

  // 4, 5. Update NOR implementation
  const norProxyContract = getAppProxyContract(async () => norAddress);
  const norAppId = await norProxyContract.appId();
  const [, norNewVersionCall, norSetAppCall] = await updateAragonApp(
    NOR_VERSION,
    NOR_IMPLEMENTATION,
    NOR_CONTENT_URI,
    norAppId,
  );

  // 6. Call finalize upgrade on NOR
  const norFinalizeScript: CallScriptAction = {
    to: norAddress,
    data: iface.encodeFunctionData('finalizeUpgrade_v3', []),
  };

  // Collect all calls
  const calls: CallScriptAction[] = [
    locatorScript,
    accountingOracleScript,
    accountingOracleFinalizeScript,
    norNewVersionCall,
    norSetAppCall,
    norFinalizeScript,
  ];

  const description = [
    `1. Update locator implementation to ${LOCATOR_IMPLEMENTAION} with new sanity checker`,
    `2. Update accounting oracle implementation ${AO_IMPLEMENTATION}`,
    `3. Call finalize upgrade on Accounting Oracle`,
    `4. Create new NOR version with address ${NOR_IMPLEMENTATION}`,
    `5. Update NOR app to new version`,
    `6. Call finalize upgrade on NOR`,
  ].join('\n');

  const voteEvmScript = encodeCallScript(calls);
  const [newVoteCalldata] = votingNewVote(voteEvmScript, description);

  await forwardVoteFromTm(newVoteCalldata);
};
