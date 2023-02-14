import { aclContract } from '../contracts';
import { encodeCallScript } from '../utils';

export const grantPermission = async (entity: string, app: string, role: string) => {
  const call = {
    to: await aclContract.getAddress(),
    data: aclContract.interface.encodeFunctionData('grantPermission', [entity, app, role]),
  };

  const encoded = encodeCallScript([call]);
  return [encoded, call] as const;
};

export const revokePermission = async (entity: string, app: string, role: string) => {
  const call = {
    to: await aclContract.getAddress(),
    data: aclContract.interface.encodeFunctionData('revokePermission', [entity, app, role]),
  };

  const encoded = encodeCallScript([call]);
  return [encoded, call] as const;
};

export const createPermission = async (entity: string, app: string, role: string, manager: string) => {
  const call = {
    to: await aclContract.getAddress(),
    data: aclContract.interface.encodeFunctionData('createPermission', [entity, app, role, manager]),
  };

  const encoded = encodeCallScript([call]);
  return [encoded, call] as const;
};
