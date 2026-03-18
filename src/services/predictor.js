function predict(data) {
  const expenses = data
    .filter((t) => t.type === "expense")
    .map((t) => Number(t.amount));

  const avg = expenses.reduce((a, b) => a + b, 0) / (expenses.length || 1);

  return {
    nextMonthEstimate: Math.round(avg * 30),
  };
}

module.exports = predict;
