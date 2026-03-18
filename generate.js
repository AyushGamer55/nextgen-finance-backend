const fs = require("fs");

// Optional CSV columns ("features") we can include beyond amount,type,category.
const OPTIONAL_COLUMNS = [
  "description",
  "date",
  "paymentMethod",
  "merchant",
  "tags",
  "account",
];

const EXPENSE_CATEGORIES = [
  "food",
  "rent",
  "shopping",
  "transport",
  "entertainment",
  "utilities",
];

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Quote if it contains a comma, quote, or newline.
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function parseArgs(argv) {
  // Simple argv parser: --key value OR --flag
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);

    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function randomDateBetween(startISO, endISO) {
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    return new Date().toISOString().slice(0, 10);
  }
  const t = start + Math.floor(Math.random() * (end - start + 1));
  return new Date(t).toISOString().slice(0, 10);
}

function buildRow({ type, category, amount, featureKeys, seed }) {
  // Deterministic-ish seeds not required; kept for readability.
  void seed;

  const row = {
    amount,
    type,
    category,
  };

  if (featureKeys.includes("description")) {
    const descBase =
      type === "income" ? "Salary" : `Spending on ${category}`;
    row.description = descBase;
  }

  if (featureKeys.includes("date")) {
    // Default range is set in main generator.
    row.date = null; // filled later
  }

  if (featureKeys.includes("paymentMethod")) {
    const methods = ["cash", "credit_card", "debit_card", "bank_transfer"];
    row.paymentMethod = pickRandom(methods);
  }

  if (featureKeys.includes("merchant")) {
    const merchants = {
      food: ["Green Bowl", "FreshMart", "Café Aurora"],
      rent: ["Landlord Co.", "City Realty", "Rentify"],
      shopping: ["ShopSphere", "Bazaar Brothers", "MallBox"],
      transport: ["MetroGo", "RoadRunner Fuel", "TransitHub"],
      entertainment: ["MovieWorld", "PlayStation Place", "EventNest"],
      utilities: ["PowerGrid", "WaterWorks", "UtilityPlus"],
      salary: ["Employer Inc.", "PayrollPro", "SalaryWave"],
      income: ["Employer Inc.", "PayrollPro", "SalaryWave"],
      other: ["Corner Store", "General Mart", "MerchantX"],
    };
    const list = merchants[category] || merchants.other;
    row.merchant = pickRandom(list);
  }

  if (featureKeys.includes("tags")) {
    const pool =
      type === "income"
        ? ["salary", "monthly", "payroll"]
        : ["budget", category, "recurring", "weekly", "essentials"];
    // Join with semicolon to avoid commas in CSV causing extra fields.
    row.tags = `${pickRandom(pool)};${pickRandom(pool)}`;
  }

  if (featureKeys.includes("account")) {
    const accounts = ["checking", "savings", "credit_card", "wallet"];
    row.account = pickRandom(accounts);
  }

  return row;
}

function main() {
  const args = parseArgs(process.argv);

  const rows = Math.max(1, Number(args.rows ?? 500));
  const features = Math.max(0, Number(args.features ?? 3));
  const out = String(args.out ?? "transactions.csv");

  const incomeProbability = Math.min(
    0.95,
    Math.max(0.05, Number(args.incomeProbability ?? 0.2))
  );

  const startDate = String(args.startDate ?? "2024-01-01");
  const endDate = String(args.endDate ?? "2024-12-31");

  // Choose N optional columns.
  const shuffled = [...OPTIONAL_COLUMNS].sort(() => Math.random() - 0.5);
  const featureKeys = shuffled.slice(0, Math.min(features, OPTIONAL_COLUMNS.length));

  // Build header: base columns first (must match your upload normalization),
  // then optional feature columns in the chosen order.
  const headerKeys = ["amount", "type", "category", ...featureKeys];

  let csv = `${headerKeys.map(csvEscape).join(",")}\n`;

  for (let i = 0; i < rows; i++) {
    const type = Math.random() > incomeProbability ? "expense" : "income";
    const amount =
      type === "income"
        ? Math.floor(Math.random() * 9000) + 1000 // 1000..9999
        : Math.floor(Math.random() * 4900) + 100; // 100..4999

    const category =
      type === "income" ? "salary" : pickRandom(EXPENSE_CATEGORIES);

    const row = buildRow({
      type,
      category,
      amount,
      featureKeys,
      seed: i,
    });

    // Fill date after build (so buildRow stays simple).
    if (featureKeys.includes("date")) {
      row.date = randomDateBetween(startDate, endDate);
    }

    const line = headerKeys.map((k) => csvEscape(row[k])).join(",");
    csv += `${line}\n`;
  }

  fs.writeFileSync(out, csv, "utf8");
  console.log(
    `CSV generated: ${rows} rows -> ${out} (features: ${featureKeys.join(
      ", "
    ) || "none"})`
  );
}

main();

