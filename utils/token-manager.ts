import { tmAddress, tmContract } from '@contracts';
import { logger } from './logger';
import { getSignerAddress } from './contract';

export const isTokenManagerAddress = (address: string) => {
  return tmAddress.toLocaleLowerCase() === address.toLocaleLowerCase();
};

export const checkTmCanForward = async () => {
  const signerAddress = await getSignerAddress(tmContract);
  const canForward = await tmContract.canForward(signerAddress, '0x');

  if (!canForward) {
    logger.warn('TM can not forward, check your LDO balance');
    return false;
  }

  return true;
};

export const throwIfCanNotForward = async (error: unknown) => {
  if (error instanceof Error && 'reason' in error && error.reason === 'TM_CAN_NOT_FORWARD') {
    logger.warn('TM can not forward, check your LDO balance');
    throw error;
  }
};
