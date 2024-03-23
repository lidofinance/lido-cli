export const isTrue = (value: string | number) => {
  const lowerValue = value.toLocaleString().toLocaleLowerCase();
  const trueValues = ['true', '1', 'yes', 'y'];
  return trueValues.includes(lowerValue);
};
