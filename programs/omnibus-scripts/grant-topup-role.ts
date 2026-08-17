import { locatorContract } from '@contracts';
import { wallet } from '@providers';
import { authorizedCall } from '@utils';
import { Contract, Interface, ZeroAddress } from 'ethers';

// Grants TOP_UP_ROLE on the TopUpGateway to the account the DSM depositor bot signs with.
//
// A fresh protocol deploy leaves the role with ZERO holders and its admin is the Aragon Agent,
// so granting it is governance rather than a direct call. Until it is granted, the bot's CMv2
// (0x02 compounding) top-up path reverts AccessControlUnauthorizedAccount on every cycle — and
// it reverts only AFTER the bot has fetched the module keys, downloaded a ~14.5 MB beacon state
// and built the Merkle proofs, so the top-up stays 100% untested while the CL traffic is burned
// indefinitely. Seen on glamsterdam-devnet-8 (~125 reverts/hour for ~2.5 days).
//
// Holder defaults to the signing wallet, which is what devnet DSM bots run with; set
// TOP_UP_ROLE_HOLDER when the bots sign with their own key.
export const grantTopUpRole = async () => {
  const holder = process.env.TOP_UP_ROLE_HOLDER || wallet.address;

  // Resolved from the locator on-chain rather than through `topUpGatewayContract`: that accessor
  // reads `getOptionalDeployedAddress('topUpGateway.proxy', 'topUpGateway')`, which silently
  // yields ZeroAddress when the deployed-address file uses neither key — and then every call
  // decodes as `BAD_DATA value="0x"`, which reads like an ABI mismatch and sends you hunting in
  // the wrong place. The locator is the protocol's own source of truth and cannot drift.
  const gatewayAddress: string = await locatorContract.topUpGateway();

  if (!gatewayAddress || gatewayAddress === ZeroAddress) {
    console.log('[top-up] LidoLocator.topUpGateway() is unset — this build has no gateway, nothing to grant');
    return;
  }

  const gatewayIface = new Interface([
    'function TOP_UP_ROLE() view returns (bytes32)',
    'function hasRole(bytes32,address) view returns (bool)',
    'function getRoleMemberCount(bytes32) view returns (uint256)',
    'function grantRole(bytes32,address)',
  ]);

  const gateway = new Contract(gatewayAddress, gatewayIface, wallet);
  const role: string = await gateway.TOP_UP_ROLE();

  if (await gateway.hasRole(role, holder)) {
    console.log('[top-up] already granted, skip:', holder, 'on', gatewayAddress);
    return;
  }

  console.log('[top-up] granting TOP_UP_ROLE to', holder, 'on TopUpGateway', gatewayAddress);
  await authorizedCall(gateway, 'grantRole', [role, holder]);

  // authorizedCall logs and swallows the failure of all three legs and still returns, so it
  // reads as success when nothing landed. Reading the role back is the only honest gate.
  if (!(await gateway.hasRole(role, holder))) {
    throw new Error(`TOP_UP_ROLE grant did not land: ${holder} still lacks the role on ${gatewayAddress}`);
  }

  const members = await gateway.getRoleMemberCount(role);
  console.log('[top-up] granted:', holder, '| role members:', members.toString());
};
