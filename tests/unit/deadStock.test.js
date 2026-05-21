const { calculateDeadStockPrice } = require('../../lib/deadStock');

describe('Dead stock pricing (unit)', () => {
  const basePrice = 100;
  const now = new Date('2026-06-01');

  test('no discount within 30 days', () => {
    const createdAt = new Date('2026-05-15');
    expect(calculateDeadStockPrice(basePrice, createdAt, now)).toBe(100);
  });

  test('10% discount after 33 days (one step)', () => {
    const createdAt = new Date('2026-04-29');
    expect(calculateDeadStockPrice(basePrice, createdAt, now)).toBe(90);
  });

  test('price floor is 1', () => {
    const createdAt = new Date('2020-01-01');
    expect(calculateDeadStockPrice(5, createdAt, now)).toBe(1);
  });
});
