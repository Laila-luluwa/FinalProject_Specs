const {
  calculateLineTotal,
  calculateOrderTotal,
} = require('../../services/order.service');

describe('Order calculations (unit)', () => {
  test('calculateLineTotal multiplies quantity by price', () => {
    expect(calculateLineTotal(3, 25.5)).toBe(76.5);
  });

  test('calculateOrderTotal sums line totals', () => {
    const items = [
      { lineTotal: 100 },
      { lineTotal: 50.5 },
    ];
    expect(calculateOrderTotal(items)).toBe(150.5);
  });
});
