/**
 * Pure dead-stock pricing (unit-tested).
 * After 30 days unsold: 10% discount every 3 days, floor price 1.
 */
function calculateDeadStockPrice(price, createdAt, now = new Date()) {
  const diffDays = Math.floor((now - new Date(createdAt)) / (1000 * 60 * 60 * 24));
  if (diffDays <= 30) return price;

  const discountSteps = Math.floor((diffDays - 30) / 3);
  const discount = 0.1 * discountSteps;
  const newPrice = price * (1 - discount);
  return Math.max(newPrice, 1);
}

module.exports = { calculateDeadStockPrice };
