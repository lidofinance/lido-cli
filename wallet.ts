import { Wallet } from "ethers";
import * as dotenv from "dotenv";
import { provider } from "./provider";

const { parsed } = dotenv.config();
const privateKey = parsed?.PRIVATE_KEY;

if (!privateKey) {
  throw new Error("Private key is not provided");
}

export const wallet = new Wallet(privateKey, provider);
