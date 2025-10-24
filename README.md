# CompWise-CTC
Annual ↔ Monthly payroll calculator with configurable PF/ESI/TDS rules, pro-rating, ERPNext JSON export, and PDF download

---

## ✨ Features

- **Dual input**: Enter **Annual** or **Monthly** gross
- **Standard split**: Basic % of Gross, HRA % of Basic, auto-balanced Special
- **Fixed allowances**: Conveyance, Medical, Lunch (monthly)
- **Pro-rating**: Month Days vs Payment Days affects Basic/HRA/Special
- **Configurable policies**:
  - PF (employee rate, VPF, wage ceiling, restrict-to-ceiling toggle)
  - ESI (threshold, employee rate)
  - PT (flat monthly amount)
  - TDS (new/old regime, standard deduction, 87A rebate threshold, slab engine + 4% cess)
- **Exports**:
  - **PDF** of the results panel (dynamic import of `html2pdf.js`)
  - **ERPNext Salary Structure Assignment JSON** (monthly full-month figures)
- **Presets**: Quick-fill sample employees with monthly gross + fixed allowances
- **Dev Test Suite**: In-app “Run Tests” button validates key calculations
- **UX niceties**: Warns when fixed allowances exceed the room left after Basic/HRA

---

## 🖼️ Screens

- **Left panel**: Inputs + Policy Config (PF/ESI/TDS) + Exports + Test Suite  
- **Right panel**: Standardized split table and Deductions/Net table (Monthly & Annual)

---

## 🧮 Default Policy (editable in UI)

```ts
basicPctOfGross: 0.40
hraPctOfBasic: 0.50
pf: {
  apply: true, employeeRate: 0.12, vpfRate: 0,
  restrictBaseToCeiling: true, wageCeiling: 15000
}
esi: { apply: false, monthlyThreshold: 21000, employeeRate: 0.0075 }
pt:  { apply: true, monthlyAmount: 200 }
tds: {
  apply: true, regime: "new", standardDeduction: 50000,
  rebate87AThreshold: 700000, cessRate: 0.04,
  slabsNew: [0–3L:0%, 3–6L:5%, 6–9L:10%, 9–12L:15%, 12–15L:20%, 15L+:30%],
  slabsOld: [0–2.5L:0%, 2.5–5L:5%, 5–10L:20%, 10L+:30%]
}
