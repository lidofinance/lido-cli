import { aragonAgentAddress } from '@contracts';
import { provider } from '@providers';
import { encodeFromAgent, votingNewVote } from '@scripts';
import { CallScriptAction, encodeCallScript, forwardVoteFromTm } from '@utils';
import { Contract, Interface } from 'ethers';

// One-off fix: register CMv2 performance-oracle consensus members + grant SUBMIT_DATA_ROLE.
// devnet-cmv2-start.ts sets updateInitialEpoch + role grants but never calls addMember, so the
// CMv2 HashConsensus stays empty and cm-1/cm-2 crash with IsNotMemberException. Mirror the main
// AccountingOracle consensus (3 members, quorum 2). All calls executed from the Aragon Agent.
export const addCmv2OracleMembers = async () => {
  const HASH_CONSENSUS = '0x43a1dc2D481bc3B48c152a332a90E28924CA9617';
  const ORACLE = '0xE072523bbb01c10C3AA3fc21b15F213A421c6Ec8';
  const SUBMIT_DATA_ROLE = '0x65fa0c17458517c727737e4153dd477fa3e328cf706640b0f68b1a285c5990da';

  const members = [
    '0xb52bA7cD8D31C4fb94773B8b56d0696CeFDb9573',
    '0xb949E971F6D076F6a22D24f7E4290fB14FC61899',
    '0xCC343048aCB49DA92d752f1a46D47093258D1060',
  ];
  // progressive quorum so each addMember keeps quorum > totalMembers / 2; final = 2
  const quorums = [1, 2, 2];

  const hcIface = new Interface([
    'function addMember(address,uint256)',
    'function getMembers() view returns (address[],uint256[])',
    'function getQuorum() view returns (uint256)',
  ]);
  const oracleIface = new Interface([
    'function grantRole(bytes32,address)',
    'function hasRole(bytes32,address) view returns (bool)',
  ]);

  const hc = new Contract(HASH_CONSENSUS, hcIface, provider);
  const oracle = new Contract(ORACLE, oracleIface, provider);

  const [existing] = await hc.getMembers();
  const existingLc: string[] = existing.map((a: string) => a.toLowerCase());
  console.log('[cmv2-oracle] existing members:', existingLc, 'quorum:', (await hc.getQuorum()).toString());

  const calls: CallScriptAction[] = [];
  const items: string[] = [];
  let i = 0;

  for (let k = 0; k < members.length; k++) {
    const m = members[k];
    if (existingLc.includes(m.toLowerCase())) {
      console.log('[cmv2-oracle] already a member, skip addMember:', m);
      continue;
    }
    items.push(`${i++}. Add oracle consensus member ${m} (quorum ${quorums[k]})`);
    const [, script] = encodeFromAgent({
      to: HASH_CONSENSUS,
      data: hcIface.encodeFunctionData('addMember', [m, quorums[k]]),
    });
    calls.push(script);
  }

  for (const m of members) {
    if (await oracle.hasRole(SUBMIT_DATA_ROLE, m)) {
      console.log('[cmv2-oracle] already has SUBMIT_DATA_ROLE, skip grant:', m);
      continue;
    }
    items.push(`${i++}. Grant SUBMIT_DATA_ROLE to ${m} on CMv2 oracle ${ORACLE}`);
    const [, script] = encodeFromAgent({
      to: ORACLE,
      data: oracleIface.encodeFunctionData('grantRole', [SUBMIT_DATA_ROLE, m]),
    });
    calls.push(script);
  }

  if (calls.length === 0) {
    console.log('[cmv2-oracle] nothing to do; members + roles already set');
    return;
  }

  console.log('[cmv2-oracle] agent:', aragonAgentAddress);
  console.log('[cmv2-oracle] vote items:\n' + items.join('\n'));
  const voteEvmScript = encodeCallScript(calls);
  const [newVoteCalldata] = votingNewVote(voteEvmScript, items.join('\n'));
  await forwardVoteFromTm(newVoteCalldata);
  console.log('[cmv2-oracle] vote submitted/enacted.');
};
