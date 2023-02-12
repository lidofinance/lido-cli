import { parseEther } from "ethers";
import { program } from "../command";
import { tmContract } from "../contracts";
import { resumeLidoAndSetStakingLimit, votingForward } from "../scripts";

const tokenManager = program.command("token-manager");

tokenManager
  .command("start-protocol")
  .option("-l, --staking-limit <number>", "daily staking limit", "150000")
  .action(async (options) => {
    const { stakingLimit } = options;
    const limit = parseEther(stakingLimit);

    console.log("staking limit", limit);

    const [lidoCalldata] = resumeLidoAndSetStakingLimit(limit);
    const [votingCalldata] = votingForward(lidoCalldata);

    await tmContract.forward(votingCalldata);

    console.log("vote started");
  });
