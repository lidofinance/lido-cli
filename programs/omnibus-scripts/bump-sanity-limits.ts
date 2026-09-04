import { aragonAgentAddress, sanityCheckerAddress } from '@contracts';
import { provider } from '@providers';
import { encodeFromAgent, votingNewVote } from '@scripts';
import { CallScriptAction, encodeCallScript, forwardVoteFromTm } from '@utils';
import { Contract, Interface, ZeroAddress } from 'ethers';

// One-off devnet fix: relax OracleReportSanityChecker limits so the AccountingOracle can
// land a report after a long stall. AO was stuck ~18 frames; the bundled CL-balance increase
// trips IncorrectTotalCLBalanceIncrease (annualBalanceIncreaseBPLimit, 10% APR) because the
// post-outage penalty->recovery swing pushes the effective rate to ~23% APR. Raise the
// increase cap to 100% and the positive-rebase cap to 100% in a single setOracleReportLimits
// call; every other limit is read on-chain and re-passed unchanged. After AO catches up once,
// subsequent single-frame deltas are tiny and would pass even at the original limits.
// All calls executed from the Aragon Agent (DEFAULT_ADMIN of the sanity checker).
export const bumpSanityLimits = async () => {
  const SANITY_CHECKER = sanityCheckerAddress;
  const ALL_LIMITS_MANAGER_ROLE = '0x5bf88568a012dfc9fe67407ad6775052bddc4ac89902dea1f4373ef5d9f1e35b';

  // LimitsList index -> field (see OracleReportSanityChecker.LimitsList)
  const ANNUAL_BALANCE_INCREASE_BP_IDX = 2; // annualBalanceIncreaseBPLimit (BP, 10000 = 100%)
  const MAX_POSITIVE_TOKEN_REBASE_IDX = 10; // maxPositiveTokenRebase (1e9 = 100%)
  const TARGET_ANNUAL_BALANCE_INCREASE_BP = 10_000n; // 100%
  const TARGET_MAX_POSITIVE_TOKEN_REBASE = 1_000_000_000n; // 1e9 == 100%

  const LIMITS_TUPLE = `(${Array(16).fill('uint256').join(',')})`;
  const scIface = new Interface([
    `function getOracleReportLimits() view returns (${LIMITS_TUPLE})`,
    `function setOracleReportLimits(${LIMITS_TUPLE} _limitsList, address _secondOpinionOracle)`,
    'function secondOpinionOracle() view returns (address)',
    'function grantRole(bytes32,address)',
    'function hasRole(bytes32,address) view returns (bool)',
  ]);

  const sc = new Contract(SANITY_CHECKER, scIface, provider);

  const current = await sc.getOracleReportLimits();
  const limits = (current as unknown as bigint[]).map((v) => BigInt(v));
  const secondOpinion = await sc.secondOpinionOracle();

  console.log('[bump-sanity] current limits:', limits.map((v) => v.toString()).join(','));
  console.log('[bump-sanity] secondOpinionOracle:', secondOpinion);

  const newLimits = [...limits];
  newLimits[ANNUAL_BALANCE_INCREASE_BP_IDX] = TARGET_ANNUAL_BALANCE_INCREASE_BP;
  newLimits[MAX_POSITIVE_TOKEN_REBASE_IDX] = TARGET_MAX_POSITIVE_TOKEN_REBASE;
  console.log('[bump-sanity] new limits:    ', newLimits.map((v) => v.toString()).join(','));

  const secondOpinionArg = secondOpinion === ZeroAddress ? ZeroAddress : secondOpinion;

  const calls: CallScriptAction[] = [];
  const items: string[] = [];
  let i = 0;

  const agentHasRole = await sc.hasRole(ALL_LIMITS_MANAGER_ROLE, aragonAgentAddress);
  if (!agentHasRole) {
    items.push(`${i++}. Grant ALL_LIMITS_MANAGER_ROLE to Agent ${aragonAgentAddress} on sanity checker`);
    const [, grantScript] = encodeFromAgent({
      to: SANITY_CHECKER,
      data: scIface.encodeFunctionData('grantRole', [ALL_LIMITS_MANAGER_ROLE, aragonAgentAddress]),
    });
    calls.push(grantScript);
  } else {
    console.log('[bump-sanity] Agent already holds ALL_LIMITS_MANAGER_ROLE, skip grant');
  }

  items.push(
    `${i++}. setOracleReportLimits: annualBalanceIncreaseBPLimit ${limits[ANNUAL_BALANCE_INCREASE_BP_IDX]} -> ${TARGET_ANNUAL_BALANCE_INCREASE_BP}, ` +
      `maxPositiveTokenRebase ${limits[MAX_POSITIVE_TOKEN_REBASE_IDX]} -> ${TARGET_MAX_POSITIVE_TOKEN_REBASE} (other limits unchanged)`,
  );
  const [, setScript] = encodeFromAgent({
    to: SANITY_CHECKER,
    data: scIface.encodeFunctionData('setOracleReportLimits', [newLimits, secondOpinionArg]),
  });
  calls.push(setScript);

  console.log('[bump-sanity] agent:', aragonAgentAddress);
  console.log('[bump-sanity] vote items:\n' + items.join('\n'));

  const voteEvmScript = encodeCallScript(calls);
  const [newVoteCalldata] = votingNewVote(voteEvmScript, items.join('\n'));
  await forwardVoteFromTm(newVoteCalldata);
  console.log('[bump-sanity] vote submitted/enacted.');
};
