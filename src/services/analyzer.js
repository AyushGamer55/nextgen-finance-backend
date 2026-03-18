function analyze(data) {
  let income = 0;
  let expense = 0;
  let categoryMap = {};

  data.forEach((t) => {
    const amount = Number(t.amount);

    if (t.type === "income") income += amount;
    else expense += amount;

    const category = t.category || "other";

    if (!categoryMap[category]) categoryMap[category] = 0;
    categoryMap[category] += amount;
  });

  const insights = [];

  // Overspending
  if (expense > income) {
    insights.push("⚠️ You are spending more than you earn");
  } else {
    insights.push("✅ You are saving money");
  }

  // Category dominance (40% threshold of total expense)
  for (let cat in categoryMap) {
    if (expense > 0 && categoryMap[cat] > 0.4 * expense) {
      insights.push(`💸 High spending on ${cat}`);
    }
  }

  return {
    income,
    expense,
    balance: income - expense,
    categoryBreakdown: categoryMap,
    insights,
  };
}

module.exports = analyze;
