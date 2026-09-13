(function exposeRpgRules(root) {
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function progressPercent(current, total) {
    const safeTotal = Number(total);
    return safeTotal > 0 ? Math.round((clamp(current, 0, safeTotal) / safeTotal) * 100) : 0;
  }

  function crossedMilestoneRewards(current, total, paidMilestones = []) {
    const paid = new Set(paidMilestones.map(Number));
    const percent = progressPercent(current, total);
    return [[25, 40], [50, 60], [75, 80], [100, 220]]
      .filter(([milestone]) => percent >= milestone && !paid.has(milestone))
      .map(([milestone, gold]) => ({ milestone, gold }));
  }

  const rules = Object.freeze({ clamp, progressPercent, crossedMilestoneRewards });
  root.RPG_RULES = rules;
  if (typeof module !== "undefined") module.exports = rules;
})(globalThis);
