export const formatDate = (date: Date) => {
  const intl = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    timeZone: 'UTC',
  });

  return intl.format(date);
};
