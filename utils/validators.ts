import { ValidatorContainer } from 'providers/cl-types';

export const getValidatorsMap = (validators: ValidatorContainer[]) => {
  return validators.reduce(
    (acc, validator) => {
      acc[validator.validator.pubkey] = validator;
      return acc;
    },
    {} as Record<string, ValidatorContainer>,
  );
};
