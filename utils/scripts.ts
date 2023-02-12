import { AbiCoder } from "ethers";

export interface CallScriptAction {
  to: string;
  data: string;
}

export const CALLSCRIPT_ID = "0x00000001";

export function encodeCallScript(actions: CallScriptAction[]): string {
  const abiCoder = AbiCoder.defaultAbiCoder();

  return actions.reduce((script: string, { to, data }) => {
    const address = abiCoder.encode(["address"], [to]);
    const dataLength = abiCoder.encode(["uint256"], [(data.length - 2) / 2]);

    return script + address.slice(26) + dataLength.slice(58) + data.slice(2);
  }, CALLSCRIPT_ID);
}
