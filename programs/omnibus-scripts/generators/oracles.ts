import prompts from 'prompts';
import { aragonAgentAddress } from '@contracts';
import { encodeFromAgent } from '@scripts';
import { CallScriptActionWithDescription, logger } from '@utils';
import { Contract, isAddress } from 'ethers';
import { encodeFromAgentGrantRole } from './access-control';

export const promptScriptsOracleMembersIfEmpty = async (
  oracleName: string,
  hashConsensusContract: Contract,
  initialMembers: number,
) => {
  const [members] = await hashConsensusContract.getMembers();

  if (members.length === 0) {
    logger.log(`Members list is empty. Preparing script`);
    return await promptScriptsOracleMembers(oracleName, hashConsensusContract, initialMembers);
  }

  logger.warn(`Members list is not empty. Skipping adding members`);
  return [];
};

export const promptScriptsOracleMembers = async (
  oracleName: string,
  hashConsensusContract: Contract,
  initialMembers: number,
) => {
  const calls: CallScriptActionWithDescription[] = [];

  const total = await promptMembersNumber(initialMembers);
  if (total === 0) {
    logger.warn('No members to add. Skipping adding members');
    return [];
  }
  const quorum = await promptMembersQuorum(total);

  const [, grantManageMembersRoleCall] = await encodeFromAgentGrantRole(
    `${oracleName} consensus`,
    hashConsensusContract,
    'MANAGE_MEMBERS_AND_QUORUM_ROLE',
    aragonAgentAddress,
  );
  calls.push(grantManageMembersRoleCall);

  for (let i = 0; i < total; i++) {
    const quorumForIteration = Math.min(i + 1, quorum);
    const address = await promptOracleAddress(i + 1);
    const [, addMemberCall] = await encodeFromAgentAddOracle(
      `${oracleName} consensus`,
      hashConsensusContract,
      address,
      quorumForIteration,
    );
    calls.push(addMemberCall);
  }

  return calls;
};

export const promptMembersNumber = async (initialMembers: number) => {
  const { total } = await prompts({
    type: 'number',
    name: 'total',
    initial: initialMembers,
    message: `Enter total number of members to add`,
  });

  return total;
};

export const promptMembersQuorum = async (total: number) => {
  const minQuorum = Math.min(Math.floor(total / 2) + 1, total);

  const { quorum } = await prompts({
    type: 'number',
    name: 'quorum',
    initial: Math.floor(total / 2) + 1,
    validate: (value) => {
      const isDefaultValue = value === '';
      const inRange = Number(value) >= minQuorum && Number(value) <= total;
      return isDefaultValue || inRange;
    },
    message: `Enter quorum (must be in range [${minQuorum}...${total}])`,
  });

  return quorum;
};

export const promptOracleAddress = async (index: number) => {
  const { address } = await prompts({
    type: 'text',
    name: 'address',
    validate: (value) => isAddress(value),
    message: `Enter member #${index} address`,
  });

  return address;
};

export const encodeFromAgentAddOracle = async (
  contractName: string,
  contract: Contract,
  address: string,
  quorum: number,
) => {
  return encodeFromAgent({
    to: await contract.getAddress(),
    data: contract.interface.encodeFunctionData('addMember', [address, quorum]),
    desc: `${contractName}: Add member ${address} and set quorum to ${quorum}`,
  });
};

export const promptScriptsOracleInitialEpochIfNotSet = async (oracleName: string, hashConsensusContract: Contract) => {
  const [initialEpoch, farFutureEpoch] = await Promise.all([
    getInitialEpoch(hashConsensusContract),
    getFarFutureEpoch(hashConsensusContract),
  ]);

  if (initialEpoch === farFutureEpoch) {
    logger.log(`Initial epoch is not set. Preparing script`);
    return await promptScriptsOracleInitialEpoch(oracleName, hashConsensusContract);
  }

  logger.warn(`Initial epoch is already set. Skipping update`);
  return [];
};

export const getInitialEpoch = async (hashConsensusContract: Contract) => {
  const [initialEpoch] = await hashConsensusContract.getFrameConfig();
  return initialEpoch;
};

export const getFarFutureEpoch = async (hashConsensusContract: Contract) => {
  const [slotsPerEpoch, secondsPerSlot, genesisTime] = await hashConsensusContract.getChainConfig();
  const farFutureTimestamp = 2n ** 64n;
  const farFutureSlot = (farFutureTimestamp - genesisTime) / secondsPerSlot;
  const farFutureEpoch = farFutureSlot / slotsPerEpoch;
  return farFutureEpoch;
};

export const promptScriptsOracleInitialEpoch = async (oracleName: string, hashConsensusContract: Contract) => {
  const initialEpoch = await promptOracleInitialEpoch();
  const [, updateInitialEpochCall] = await encodeFromAgentUpdateInitialEpoch(
    oracleName,
    hashConsensusContract,
    initialEpoch,
  );

  return [updateInitialEpochCall];
};

export const encodeFromAgentUpdateInitialEpoch = async (
  oracleName: string,
  contract: Contract,
  initialEpoch: number,
) => {
  return encodeFromAgent({
    to: await contract.getAddress(),
    data: contract.interface.encodeFunctionData('updateInitialEpoch', [initialEpoch]),
    desc: `${oracleName}: Update initial epoch to ${initialEpoch}`,
  });
};

export const promptOracleInitialEpoch = async () => {
  const { epoch } = await prompts({
    type: 'number',
    name: 'epoch',
    message: `Enter initial epoch`,
  });

  return Number(epoch);
};
