import { aragonAgentAddress } from '@contracts';
import { provider, wallet } from '@providers';
import { encodeFromAgent, votingNewVote } from '@scripts';
import { CallScriptAction, encodeCallScript, forwardVoteFromTm } from '@utils';
import { AbiCoder, Contract, Interface } from 'ethers';

// One-off devnet fix: re-initialize CSM (CSFeeOracle) and CMv2 performance-oracle consensus so their
// epoch demand floor lands AFTER the checkpoint (reachable history), instead of the original
// initialEpoch=293 (pre-checkpoint, unrecoverable network-wide). updateInitialEpoch on the live
// HashConsensus is locked (InitialEpochAlreadyArrived), so we deploy a fresh HashConsensus per oracle
// (its constructor sets initialEpoch=farFuture, so updateInitialEpoch works), configure it from the
// deployer wallet (admin=wallet, off-governance), then repoint the oracle via setConsensusContract
// in a single Agent vote. AccountingOracle / VEBO and Lido core are untouched.
//
// The new HashConsensus uses the EXACT creation bytecode of each currently-deployed consensus
// (pulled from its original creation tx), so it is byte-for-byte the same implementation the oracle
// already expects — only the constructor args change (admin -> wallet; chain config + reportProcessor
// unchanged).
export const reinitCsmCmv2Consensus = async () => {
  const CHAIN = { slotsPerEpoch: 32n, secondsPerSlot: 12n, genesisTime: 1782387000n, epochsPerFrame: 24n, fastLane: 0n };
  // Current epoch ~1156; set a recent, post-checkpoint initialEpoch. floor = initialEpoch - frame = 1126 (>> checkpoint ~906).
  const NEW_INITIAL_EPOCH = 1150n;

  const MANAGE_MEMBERS_AND_QUORUM_ROLE = '0x66a484cf1a3c6ef8dfd59d24824943d2853a29d96f34a01271efc55774452a51';
  const MANAGE_CONSENSUS_CONTRACT_ROLE = '0x04a0afbbd09d5ad397fc858789da4f8edd59f5ca5098d70faa490babee945c3b';
  const SUBMIT_DATA_ROLE = '0x65fa0c17458517c727737e4153dd477fa3e328cf706640b0f68b1a285c5990da';

  const members = [
    '0xb52bA7cD8D31C4fb94773B8b56d0696CeFDb9573',
    '0xb949E971F6D076F6a22D24f7E4290fB14FC61899',
    '0xCC343048aCB49DA92d752f1a46D47093258D1060',
  ];
  const quorums = [1n, 2n, 2n]; // progressive; final quorum = 2 (mirrors AO/VEBO)

  // Congested public-devnet mempool: force a high tip so wallet txs are mined (base fee ~7 wei).
  const GAS = { maxPriorityFeePerGas: 60_000_000_000n, maxFeePerGas: 120_000_000_000n };

  const targets = [
    {
      name: 'CSM-CSFeeOracle',
      oracle: '0x0d277FeF9Fa1B6f5E32Edc3200b682d9cF8077d3',
      creationTx: '0x4204ed322aa7afa343bbd505927ff32985cf11c5ada241c9ab8d7508b84f3faa',
      grantSubmitData: true, // CSFeeOracle members lack SUBMIT_DATA_ROLE
    },
    {
      name: 'CMv2-Oracle',
      oracle: '0xE072523bbb01c10C3AA3fc21b15F213A421c6Ec8',
      creationTx: '0xc967651a48bcbaf70841dcf8786198c32a8d2bdaacc3baad708ce79991bce8b2',
      grantSubmitData: false, // CMv2 members already have SUBMIT_DATA_ROLE
    },
  ];

  const hcIface = new Interface([
    'function updateInitialEpoch(uint256)',
    'function grantRole(bytes32,address)',
    'function addMember(address,uint256)',
    'function getInitialRefSlot() view returns (uint256)',
    'function getMembers() view returns (address[],uint256[])',
    'function getQuorum() view returns (uint256)',
  ]);
  const oracleIface = new Interface([
    'function grantRole(bytes32,address)',
    'function setConsensusContract(address)',
  ]);
  const coder = AbiCoder.defaultAbiCoder();
  const ctorTypes = ['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'address', 'address'];
  const ctorArgsLen = 7 * 64; // 7 abi words, hex chars (no 0x)

  const calls: CallScriptAction[] = [];
  const items: string[] = [];
  let i = 0;

  for (const t of targets) {
    // --- 1) reconstruct exact creation bytecode from the original deploy tx, swap constructor args ---
    const origTx = await provider.getTransaction(t.creationTx);
    if (!origTx?.data) throw new Error(`no creation tx data for ${t.name}`);
    const initCode = origTx.data.slice(2); // strip 0x
    const creationBytecode = '0x' + initCode.slice(0, initCode.length - ctorArgsLen);
    const newArgs = coder
      .encode(ctorTypes, [
        CHAIN.slotsPerEpoch, CHAIN.secondsPerSlot, CHAIN.genesisTime, CHAIN.epochsPerFrame, CHAIN.fastLane,
        wallet.address, t.oracle,
      ])
      .slice(2);
    const deployData = creationBytecode + newArgs;

    console.log(`[reinit] ${t.name}: deploying fresh HashConsensus (admin=${wallet.address}, reportProcessor=${t.oracle}) ...`);
    // HashConsensus deploy is heavy (~20M gas observed for the originals); block gas limit is ~190M.
    const dtx = await wallet.sendTransaction({ data: deployData, gasLimit: 25_000_000n, ...GAS });
    const drcpt = await dtx.wait();
    const newHc = drcpt!.contractAddress!;
    console.log(`[reinit] ${t.name}: new HashConsensus = ${newHc}`);

    // --- 2) configure the new HC from the wallet (admin) ---
    const hc = new Contract(newHc, hcIface, wallet);
    await (await hc.updateInitialEpoch(NEW_INITIAL_EPOCH, GAS)).wait();
    await (await hc.grantRole(MANAGE_MEMBERS_AND_QUORUM_ROLE, wallet.address, GAS)).wait();
    for (let k = 0; k < members.length; k++) {
      await (await hc.addMember(members[k], quorums[k], GAS)).wait();
    }
    const initialRefSlot = (await hc.getInitialRefSlot()).toString();
    const [mm] = await hc.getMembers();
    const q = (await hc.getQuorum()).toString();
    console.log(`[reinit] ${t.name}: HC configured initialEpoch=${NEW_INITIAL_EPOCH} initialRefSlot=${initialRefSlot} members=${mm.length} quorum=${q}`);

    // --- 3) Agent vote actions on the ORACLE: grant role -> setConsensusContract [-> grant SUBMIT_DATA] ---
    {
      const [, s] = encodeFromAgent({ to: t.oracle, data: oracleIface.encodeFunctionData('grantRole', [MANAGE_CONSENSUS_CONTRACT_ROLE, aragonAgentAddress]) });
      calls.push(s); items.push(`${i++}. Grant MANAGE_CONSENSUS_CONTRACT_ROLE to Agent on ${t.name}`);
    }
    {
      const [, s] = encodeFromAgent({ to: t.oracle, data: oracleIface.encodeFunctionData('setConsensusContract', [newHc]) });
      calls.push(s); items.push(`${i++}. ${t.name}.setConsensusContract(${newHc}) [fresh HC, initialEpoch=${NEW_INITIAL_EPOCH}]`);
    }
    if (t.grantSubmitData) {
      for (const m of members) {
        const [, s] = encodeFromAgent({ to: t.oracle, data: oracleIface.encodeFunctionData('grantRole', [SUBMIT_DATA_ROLE, m]) });
        calls.push(s); items.push(`${i++}. Grant SUBMIT_DATA_ROLE to ${m} on ${t.name}`);
      }
    }
  }

  console.log('[reinit] agent:', aragonAgentAddress);
  console.log('[reinit] vote items:\n' + items.join('\n'));

  const voteEvmScript = encodeCallScript(calls);
  const [newVoteCalldata] = votingNewVote(voteEvmScript, items.join('\n'));
  await forwardVoteFromTm(newVoteCalldata);
  console.log('[reinit] vote submitted/enacted.');
};
