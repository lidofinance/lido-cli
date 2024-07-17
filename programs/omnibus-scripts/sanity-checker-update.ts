import { locatorContract } from '@contracts';

import { encodeFromAgent, votingNewVote } from '@scripts';
import { CallScriptAction, encodeCallScript, forwardVoteFromTm } from '@utils';
import { Interface } from 'ethers';

const NEW_LOCATOR_IMPLEMENTAION = '0xcf720cb5635523ed1de57bb0d984445f6b7ca628';

export const sanityChecker = async () => {
  const iface = new Interface(['function proxy__upgradeTo(address)']);

  // Update Locator implementation
  const locatorProxyAddress = await locatorContract.getAddress();
  const [, locatorUpgradeScript] = encodeFromAgent({
    to: locatorProxyAddress,
    data: iface.encodeFunctionData('proxy__upgradeTo', [NEW_LOCATOR_IMPLEMENTAION]),
  });

  const calls: CallScriptAction[] = [locatorUpgradeScript];
  const description = `Update locator implementation to ${NEW_LOCATOR_IMPLEMENTAION} with new Sanity Checker`;

  const voteEvmScript = encodeCallScript(calls);
  const [newVoteCalldata] = votingNewVote(voteEvmScript, description);

  await forwardVoteFromTm(newVoteCalldata);
};
