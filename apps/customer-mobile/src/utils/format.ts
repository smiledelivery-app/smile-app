export const formatMoney = (minor: number) => `₦${(minor / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;

export const makeIdempotencyKey = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
  const random = Math.random() * 16 | 0;
  return (character === 'x' ? random : (random & 3 | 8)).toString(16);
});
