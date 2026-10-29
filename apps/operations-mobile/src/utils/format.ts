export const formatMoney = (minor: number) => `₦${(minor / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
