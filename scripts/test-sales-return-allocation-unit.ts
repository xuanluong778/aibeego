import assert from 'node:assert/strict';
import {
  allocatePartialReturn,
  mergeReturnRounds,
  SALES_RETURN_ALLOCATION_POLICY_V,
} from '../apps/api/dist/sales/sales-return-allocation.util.js';

const results: Array<{ name: string; pass: boolean }> = [];
function record(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${name}`);
}

function main() {
  const a1 = allocatePartialReturn({
    subtotal: 200,
    discount: 20,
    shippingFee: 10,
    total: 190,
    amountPaid: 190,
    orderLines: [
      { orderItemId: 'a', quantity: 2, returnedQtyBefore: 0, totalPrice: 120 },
      { orderItemId: 'b', quantity: 1, returnedQtyBefore: 0, totalPrice: 80 },
    ],
    returnLines: [{ orderItemId: 'a', quantity: 1 }],
  });
  const sumDisc = a1.lines.reduce((s, l) => s + l.discountShare, 0);
  record(
    'Một lần trả: tổng CK phân bổ = order.discount × tỷ merchandise',
    Math.abs(sumDisc - 6) < 0.02,
  );
  record('Policy version', a1.policyVersion === SALES_RETURN_ALLOCATION_POLICY_V);

  const a2 = allocatePartialReturn({
    subtotal: 200,
    discount: 20,
    shippingFee: 10,
    total: 190,
    amountPaid: 190,
    priorReturnedMerchandise: 60,
    orderLines: [
      { orderItemId: 'a', quantity: 2, returnedQtyBefore: 1, totalPrice: 120 },
      { orderItemId: 'b', quantity: 1, returnedQtyBefore: 0, totalPrice: 80 },
    ],
    returnLines: [{ orderItemId: 'b', quantity: 1 }],
  });
  const merged = mergeReturnRounds([a1, a2]);
  record(
    'Hai lần trả: revenueReversal tổng không vượt subtotal',
    merged.revenueReversal <= 200 + 0.02,
  );
  record(
    'Hai lần trả: merchandise tổng ≤ subtotal',
    merged.merchandise <= 200 + 0.02,
  );

  let threw = false;
  try {
    allocatePartialReturn({
      subtotal: 100,
      discount: 0,
      shippingFee: 0,
      total: 100,
      amountPaid: 50,
      orderLines: [{ orderItemId: 'x', quantity: 5, returnedQtyBefore: 0, totalPrice: 100 }],
      returnLines: [{ orderItemId: 'x', quantity: 6 }],
    });
  } catch {
    threw = true;
  }
  record('Trả vượt slg dòng bị từ chối', threw);

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} unit allocation`);
  if (failed.length) process.exit(1);
}

main();