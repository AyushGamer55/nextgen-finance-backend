import json
import random
import sys
from typing import Dict, List


def safe_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def build_feature_vector(row: Dict) -> List[float]:
    return [
        safe_float(row.get("income")),
        safe_float(row.get("expenses")),
        safe_float(row.get("savings")),
        safe_float(row.get("remainingBalance")),
        safe_float(row.get("savingsRate")),
        safe_float(row.get("expenseToIncomeRatio")),
        safe_float(row.get("topCategoryShare")),
        safe_float(row.get("discretionaryShare")),
        safe_float(row.get("essentialShare")),
        safe_float(row.get("transactionCount")),
    ]


def dot(a: List[float], b: List[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def sigmoid(value: float) -> float:
    if value >= 0:
        exp = 2.718281828459045 ** (-value)
        return 1 / (1 + exp)
    exp = 2.718281828459045 ** value
    return exp / (1 + exp)


def overspend_label(row: Dict) -> int:
    income = safe_float(row.get("income"))
    expenses = safe_float(row.get("expenses"))
    savings = safe_float(row.get("savings"))
    remaining_balance = safe_float(row.get("remainingBalance"))
    average_expenses = safe_float(row.get("averageExpenses"))
    threshold = max(income * 0.1, average_expenses * 0.5)
    return int(expenses > income or savings < 0 or remaining_balance < threshold)


def bootstrap_rows(rows: List[Dict], target_count: int = 12) -> List[Dict]:
    if not rows:
        return []

    synthetic = list(rows)
    rng = random.Random(42)

    while len(synthetic) < target_count:
        base = dict(rows[len(synthetic) % len(rows)])
        income = safe_float(base.get("income"))
        expenses = safe_float(base.get("expenses"))
        top_share = safe_float(base.get("topCategoryShare"))
        disc_share = safe_float(base.get("discretionaryShare"))
        essential_share = safe_float(base.get("essentialShare"))

        income = max(0, income * (0.88 + rng.random() * 0.24))
        expenses = max(0, expenses * (0.82 + rng.random() * 0.35))
        savings = income - expenses
        remaining_balance = max(0, safe_float(base.get("remainingBalance")) * (0.8 + rng.random() * 0.4))

        top_share = min(1, max(0, top_share * (0.9 + rng.random() * 0.2)))
        disc_share = min(1, max(0, disc_share * (0.9 + rng.random() * 0.2)))
        essential_share = min(1, max(0, essential_share * (0.9 + rng.random() * 0.2)))

        generated = {
            **base,
            "month": f"synthetic-{len(synthetic) + 1}",
            "income": round(income, 2),
            "expenses": round(expenses, 2),
            "savings": round(savings, 2),
            "remainingBalance": round(remaining_balance, 2),
            "savingsRate": round((savings / income) if income > 0 else 0, 4),
            "expenseToIncomeRatio": round((expenses / income) if income > 0 else 0, 4),
            "topCategoryShare": round(top_share, 4),
            "discretionaryShare": round(disc_share, 4),
            "essentialShare": round(essential_share, 4),
            "transactionCount": max(1, int(round(safe_float(base.get("transactionCount")) * (0.75 + rng.random() * 0.5)))),
        }
        synthetic.append(generated)

    return synthetic


def train_logistic_regression(features: List[List[float]], labels: List[int], iterations: int = 800, learning_rate: float = 0.01):
    weights = [0.0 for _ in range(len(features[0]))]
    bias = 0.0
    sample_count = max(1, len(features))

    for _ in range(iterations):
        weight_grads = [0.0 for _ in weights]
        bias_grad = 0.0

        for vector, label in zip(features, labels):
            prediction = sigmoid(dot(weights, vector) + bias)
            error = prediction - label
            for index, value in enumerate(vector):
                weight_grads[index] += error * value
            bias_grad += error

        for index in range(len(weights)):
            weights[index] -= learning_rate * (weight_grads[index] / sample_count)
        bias -= learning_rate * (bias_grad / sample_count)

    return weights, bias


def euclidean_distance(a: List[float], b: List[float]) -> float:
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5


def average_vectors(vectors: List[List[float]]) -> List[float]:
    if not vectors:
        return [0.0, 0.0, 0.0]
    width = len(vectors[0])
    return [sum(vector[index] for vector in vectors) / len(vectors) for index in range(width)]


def kmeans_cluster(points: List[List[float]], k: int = 3, iterations: int = 20):
    centers = [points[index % len(points)][:] for index in range(k)]
    assignments = [0 for _ in points]

    for _ in range(iterations):
        changed = False
        for index, point in enumerate(points):
            nearest = min(range(k), key=lambda center_index: euclidean_distance(point, centers[center_index]))
            if assignments[index] != nearest:
                assignments[index] = nearest
                changed = True

        groups = [[] for _ in range(k)]
        for assignment, point in zip(assignments, points):
            groups[assignment].append(point)

        for index in range(k):
            if groups[index]:
                centers[index] = average_vectors(groups[index])

        if not changed:
            break

    return centers, assignments


def linear_regression(points_y: List[float]):
    sample_count = len(points_y)
    if sample_count == 0:
        return 0.0, 0.0
    if sample_count == 1:
        return points_y[0], 0.0

    xs = list(range(sample_count))
    mean_x = sum(xs) / sample_count
    mean_y = sum(points_y) / sample_count
    numerator = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, points_y))
    denominator = sum((x - mean_x) ** 2 for x in xs) or 1.0
    slope = numerator / denominator
    intercept = mean_y - (slope * mean_x)
    return intercept, slope


def cluster_score(center: List[float]) -> float:
    savings_rate = center[0]
    expense_ratio = center[1]
    discretionary_share = center[2]
    return expense_ratio + discretionary_share - savings_rate


def main():
    raw = sys.stdin.read()
    payload = json.loads(raw or "{}")

    rows = payload.get("rows", [])
    current = payload.get("current") or {}

    training_rows = bootstrap_rows(rows, 12 if len(rows) < 12 else len(rows))
    if not training_rows:
        print(json.dumps({
            "overspending": {
                "prediction": "Not enough data",
                "probability": 0.0,
                "riskLevel": "low",
            },
            "behavior": {
                "segment": "Unknown",
                "cluster": -1,
            },
            "trend": {
                "nextMonthExpense": 0.0,
                "direction": "stable",
            },
            "training": {
                "sampleCount": 0,
                "syntheticCount": 0,
            },
        }))
        return

    avg_expenses = sum(safe_float(row.get("expenses")) for row in training_rows) / max(1, len(training_rows))
    for row in training_rows:
        row["averageExpenses"] = avg_expenses
    current["averageExpenses"] = avg_expenses

    x_train = [build_feature_vector(row) for row in training_rows]
    y_train = [overspend_label(row) for row in training_rows]
    x_current = build_feature_vector(current)

    if len(set(y_train)) < 2:
        overspend_prob = float(y_train[0]) if y_train else 0.0
    else:
        weights, bias = train_logistic_regression(x_train, y_train)
        overspend_prob = sigmoid(dot(weights, x_current) + bias)

    if overspend_prob >= 0.67:
        risk_level = "high"
        prediction = "Likely to overspend"
    elif overspend_prob >= 0.4:
        risk_level = "medium"
        prediction = "Borderline overspending risk"
    else:
        risk_level = "low"
        prediction = "Spending looks under control"

    cluster_points = [[row[4], row[5], row[7]] for row in x_train]
    centers, _ = kmeans_cluster(cluster_points, 3, 24)
    current_cluster_point = [x_current[4], x_current[5], x_current[7]]
    cluster_index = min(range(len(centers)), key=lambda index: euclidean_distance(current_cluster_point, centers[index]))

    ordered = sorted([(index, cluster_score(center)) for index, center in enumerate(centers)], key=lambda item: item[1])
    cluster_names = {
        ordered[0][0]: "Low spender",
        ordered[1][0]: "Moderate spender",
        ordered[2][0]: "High spender",
    }

    expense_series = [safe_float(row.get("expenses")) for row in training_rows]
    intercept, slope = linear_regression(expense_series)
    next_expense = intercept + slope * len(training_rows)

    if slope > 500:
        direction = "rising"
    elif slope < -500:
        direction = "falling"
    else:
        direction = "stable"

    print(json.dumps({
        "overspending": {
            "prediction": prediction,
            "probability": round(overspend_prob, 4),
            "riskLevel": risk_level,
            "labelRule": "expenses > income OR savings < 0 OR remaining balance below safety threshold",
            "model": "Custom Logistic Regression",
        },
        "behavior": {
            "segment": cluster_names.get(cluster_index, "Moderate spender"),
            "cluster": cluster_index,
            "model": "Custom K-Means",
        },
        "trend": {
            "nextMonthExpense": round(max(0.0, next_expense), 2),
            "slope": round(slope, 2),
            "direction": direction,
            "model": "Custom Linear Regression",
        },
        "training": {
            "sampleCount": len(training_rows),
            "syntheticCount": max(0, len(training_rows) - len(rows)),
        },
    }))


if __name__ == "__main__":
    main()
