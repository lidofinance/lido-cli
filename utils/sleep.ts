export const sleep = (timeoutMs: number) => {
  return new Promise((resolve) => setTimeout(resolve, timeoutMs));
};
