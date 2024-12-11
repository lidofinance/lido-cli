import { dsmAddress, dsmContract } from '@contracts';
import { encodeFromAgent } from '@scripts';
import { CallScriptActionWithDescription, logger } from '@utils';
import { isAddress } from 'ethers';
import prompts from 'prompts';

export const promptScriptsAddingGuardiansFromAgentIfEmpty = async (initialTotal: number) => {
  const guardians = await dsmContract.getGuardians();

  if (guardians.length === 0) {
    logger.log('Guardians list is empty. Preparing script');
    return await promptScriptsAddingGuardiansFromAgent(initialTotal);
  }

  logger.warn('Guardians list is not empty. Skipping adding guardians');
  return [];
};

export const promptScriptsAddingGuardiansFromAgent = async (initialTotal: number) => {
  const { total } = await prompts({
    type: 'number',
    name: 'total',
    initial: initialTotal,
    message: 'Enter number of guardians to add',
  });

  if (total === 0) {
    logger.warn('No guardians to add. Skipping adding guardians');
    return [];
  }

  const { quorum } = await prompts({
    type: 'number',
    name: 'quorum',
    initial: Math.min(Math.floor(total / 2) + 1, total),
    message: 'Enter the quorum',
  });

  const calls: CallScriptActionWithDescription[] = [];

  for (let i = 0; i < total; i++) {
    const quorumForIteration = Math.min(i + 1, quorum);
    const address = await promptGuardianAddress(i + 1);
    const [, addGuardianCall] = encodeFromAgentAddGuardian(address, quorumForIteration);

    calls.push(addGuardianCall);
  }

  return calls;
};

export const promptGuardianAddress = async (index: number) => {
  const { address } = await prompts({
    type: 'text',
    name: 'address',
    validate: (value) => isAddress(value),
    message: `Enter guardian #${index} address`,
  });

  return address;
};

export const encodeFromAgentAddGuardian = (address: string, quorum: number) => {
  return encodeFromAgent({
    to: dsmAddress,
    data: dsmContract.interface.encodeFunctionData('addGuardian', [address, quorum]),
    desc: `DSM: Add guardian ${address} and set quorum to ${quorum}`,
  });
};
