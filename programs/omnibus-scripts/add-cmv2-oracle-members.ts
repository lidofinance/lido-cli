import { aragonAgentAddress, consensusForCMv2Address, consensusForCMv2Contract } from '@contracts';
import { provider } from '@providers';
import { encodeFromAgent, votingNewVote } from '@scripts';
import { CallScriptAction, encodeCallScript, forwardVoteFromTm, getRoleHash } from '@utils';
import { Contract } from 'ethers';

import { getOracleMinQuorum, validateOracleQuorum } from './generators/oracles';

// CMv2 consensus repair in one Agent vote: initial epoch, Agent manage role, members + quorum,
// SUBMIT_DATA_ROLE on the report processor — only the items the chain still lacks.
// Env: CS_ORACLE_MEMBERS (required), CS_ORACLE_QUORUM (default: minimal majority),
// CS_ORACLE_INITIAL_EPOCH (default: current epoch + epochsPerFrame + 2; used only when unset on-chain).
export const addCmv2OracleMembers = async () => {
  const hc = consensusForCMv2Contract;
  const members = (process.env.CS_ORACLE_MEMBERS ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  if (members.length === 0) {
    throw new Error('CS_ORACLE_MEMBERS is required: comma-separated oracle member addresses');
  }
  const quorum = process.env.CS_ORACLE_QUORUM
    ? Number(process.env.CS_ORACLE_QUORUM)
    : getOracleMinQuorum(members.length);
  if (!validateOracleQuorum(quorum, members.length)) {
    throw new Error(`Quorum ${quorum} is not in range [${getOracleMinQuorum(members.length)}...${members.length}]`);
  }

  const calls: CallScriptAction[] = [];
  const items: string[] = [];
  let i = 0;

  // Initial epoch: the constructor leaves it at a far-future sentinel until updateInitialEpoch runs.
  const { initialEpoch, epochsPerFrame } = await hc.getFrameConfig();
  const { slotsPerEpoch, secondsPerSlot, genesisTime } = await hc.getChainConfig();
  const block = await provider.getBlock('latest');
  if (!block) throw new Error('Cannot read the latest block');
  const currentEpoch = Math.floor(
    (block.timestamp - Number(genesisTime)) / (Number(secondsPerSlot) * Number(slotsPerEpoch)),
  );
  const initialEpochUnset = Number(initialEpoch) > currentEpoch + 1_000_000;
  if (initialEpochUnset) {
    const target = Number(process.env.CS_ORACLE_INITIAL_EPOCH ?? currentEpoch + Number(epochsPerFrame) + 2);
    items.push(`${i++}. Update CMv2 consensus initial epoch to ${target}`);
    const [, script] = encodeFromAgent({
      to: consensusForCMv2Address,
      data: hc.interface.encodeFunctionData('updateInitialEpoch', [target]),
    });
    calls.push(script);
  } else {
    console.log('[cmv2-oracle] initial epoch already set:', initialEpoch.toString());
  }

  const manageRole = await getRoleHash(hc, 'MANAGE_MEMBERS_AND_QUORUM_ROLE');
  if (!(await hc.hasRole(manageRole, aragonAgentAddress))) {
    items.push(`${i++}. Grant MANAGE_MEMBERS_AND_QUORUM_ROLE on CMv2 consensus to ${aragonAgentAddress}`);
    const [, script] = encodeFromAgent({
      to: consensusForCMv2Address,
      data: hc.interface.encodeFunctionData('grantRole', [manageRole, aragonAgentAddress]),
    });
    calls.push(script);
  }

  const [existing] = await hc.getMembers();
  const existingLc: string[] = existing.map((a: string) => a.toLowerCase());
  console.log('[cmv2-oracle] existing members:', existingLc, 'quorum:', (await hc.getQuorum()).toString());
  let total = existingLc.length;
  for (const m of members) {
    if (existingLc.includes(m.toLowerCase())) {
      console.log('[cmv2-oracle] already a member, skip addMember:', m);
      continue;
    }
    total += 1;
    // addMember requires quorum > total / 2 after each addition; converge on the target quorum.
    const quorumForIteration = Math.min(Math.max(getOracleMinQuorum(total), 1), quorum);
    items.push(`${i++}. Add CMv2 consensus member ${m} (quorum ${quorumForIteration})`);
    const [, script] = encodeFromAgent({
      to: consensusForCMv2Address,
      data: hc.interface.encodeFunctionData('addMember', [m, quorumForIteration]),
    });
    calls.push(script);
  }
  const membersMissing = members.some((m) => !existingLc.includes(m.toLowerCase()));
  if (!membersMissing && Number(await hc.getQuorum()) !== quorum) {
    items.push(`${i++}. Set CMv2 consensus quorum to ${quorum}`);
    const [, script] = encodeFromAgent({
      to: consensusForCMv2Address,
      data: hc.interface.encodeFunctionData('setQuorum', [quorum]),
    });
    calls.push(script);
  }

  // SUBMIT_DATA_ROLE is not implied by membership: the oracle gates submitReportData on it separately.
  const oracleAddress: string = await hc.getReportProcessor();
  const oracle = new Contract(
    oracleAddress,
    [
      'function SUBMIT_DATA_ROLE() view returns (bytes32)',
      'function grantRole(bytes32,address)',
      'function hasRole(bytes32,address) view returns (bool)',
    ],
    provider,
  );
  const submitDataRole = await getRoleHash(oracle, 'SUBMIT_DATA_ROLE');
  for (const m of members) {
    if (await oracle.hasRole(submitDataRole, m)) {
      console.log('[cmv2-oracle] already has SUBMIT_DATA_ROLE, skip grant:', m);
      continue;
    }
    items.push(`${i++}. Grant SUBMIT_DATA_ROLE to ${m} on CMv2 oracle ${oracleAddress}`);
    const [, script] = encodeFromAgent({
      to: oracleAddress,
      data: oracle.interface.encodeFunctionData('grantRole', [submitDataRole, m]),
    });
    calls.push(script);
  }

  if (calls.length === 0) {
    console.log('[cmv2-oracle] nothing to do; initial epoch, members, quorum and roles already set');
    return;
  }

  console.log('[cmv2-oracle] agent:', aragonAgentAddress);
  console.log('[cmv2-oracle] vote items:\n' + items.join('\n'));
  const voteEvmScript = encodeCallScript(calls);
  const [newVoteCalldata] = votingNewVote(voteEvmScript, items.join('\n'));
  await forwardVoteFromTm(newVoteCalldata);
  console.log('[cmv2-oracle] vote submitted/enacted.');
};
