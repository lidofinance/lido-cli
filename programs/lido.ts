import { formatEther } from "ethers";
import { wallet } from "../wallet";
import { program } from "../command";
import { lidoContract } from "../contracts";

const lido = program.command("lido");

lido.command("total-supply").action(async () => {
  const totalSupply = await lidoContract.totalSupply();
  console.log("total supply", formatEther(totalSupply));
});

lido.command("is-stopped").action(async () => {
  const isStopped = await lidoContract.isStopped();
  console.log("is stopped", isStopped);
});

lido.command("is-staking-paused").action(async () => {
  const isStakingPaused = await lidoContract.isStakingPaused();
  console.log("is staking paused", isStakingPaused);
});

lido
  .command("call")
  .argument("<string>", "method name")
  .action(async (method) => {
    const result = await lidoContract[method]();
    console.log("result", result);
  });

lido
  .command("can-perform")
  .option("-a, --address <string>", "address", wallet.address)
  .option("-r, --role <string>", "role")
  .action(async (options) => {
    const { address, role } = options;
    const result = await lidoContract.canPerform(address, role, []);
    console.log("can perform", result);
  });
