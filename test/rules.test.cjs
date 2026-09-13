const test = require("node:test");
const assert = require("node:assert/strict");
const { progressPercent, crossedMilestoneRewards } = require("../js/rules.js");

test("limita o percentual de progresso entre 0 e 100", () => {
  assert.equal(progressPercent(-10, 100), 0);
  assert.equal(progressPercent(25, 100), 25);
  assert.equal(progressPercent(1000, 100), 100);
});

test("identifica todos os marcos cruzados em uma única atualização", () => {
  assert.deepEqual(crossedMilestoneRewards(80, 100), [
    { milestone: 25, gold: 40 },
    { milestone: 50, gold: 60 },
    { milestone: 75, gold: 80 },
  ]);
});

test("não volta a pagar marcos já registrados", () => {
  assert.deepEqual(crossedMilestoneRewards(100, 100, [25, 50, 75]), [{ milestone: 100, gold: 220 }]);
});
