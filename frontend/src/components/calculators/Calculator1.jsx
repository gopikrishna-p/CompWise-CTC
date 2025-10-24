import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Download, Calculator, RefreshCcw, TrendingUp, Wallet } from "lucide-react";
import EmployeeManager from "./EmployeeManager";

/**
 * CompWise-CTC Payroll Calculator — Annual ↔ Monthly
 * ----------------------------------------------
 * New in this version:
 *  • Enter **Annual Gross (cash)** OR **Monthly Gross** and the app computes both monthly & annual
 *  • Standardized split: Basic=40% of Gross; HRA=50% of Basic; Special=Balance
 *  • Shows per‑component **Monthly** and **Annual** amounts, plus Deductions & Net
 *  • Pro‑ration available (affects only Basic/HRA/Special)
 */

// ---------- Helpers ----------
const rupees = (n) => (isNaN(n) ? "₹0" : `₹${Math.round(n).toLocaleString("en-IN")}`);
const pct = (n) => `${(n * 100).toFixed(1)}%`;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// Default policy (editable in UI)
const defaultPolicy = {
  basicPctOfGross: 0.40,
  hraPctOfBasic: 0.50,
  pf: {
    apply: true,
    employeeRate: 0.12,
    vpfRate: 0.00,
    restrictBaseToCeiling: true,
    wageCeiling: 15000,
    baseIncludes: ["Basic"],
  },
  esi: {
    apply: false,
    monthlyThreshold: 21000,
    employeeRate: 0.0075,
  },
  pt: {
    apply: true,
    monthlyAmount: 200,
  },
  tds: {
    apply: true,
    regime: "new",
    standardDeduction: 50000,
    rebate87AThreshold: 700000,
    slabsNew: [
      { upto: 300000, rate: 0.00 },
      { upto: 600000, rate: 0.05 },
      { upto: 900000, rate: 0.10 },
      { upto: 1200000, rate: 0.15 },
      { upto: 1500000, rate: 0.20 },
      { upto: Infinity, rate: 0.30 },
    ],
    slabsOld: [
      { upto: 250000, rate: 0.00 },
      { upto: 500000, rate: 0.05 },
      { upto: 1000000, rate: 0.20 },
      { upto: Infinity, rate: 0.30 },
    ],
    cessRate: 0.04,
  },
};

// Offer presets (optional quick‑fill)
const defaultPresets = [
  { name: "Pulicharla Gopi Krishna", gross: 30000, fixed: { conveyance: 1300, medical: 1200, lunch: 1500 } }
];

// Compute income tax on annual taxable income using slabs
function computeSlabTax(annualTaxable, slabs) {
  let tax = 0;
  let last = 0;
  for (const { upto, rate } of slabs) {
    const span = Math.min(annualTaxable, upto) - last;
    if (span > 0) tax += span * rate;
    last = upto;
    if (annualTaxable <= upto) break;
  }
  return tax;
}

function usePayrollCalculator({
  monthlyGross,
  fixedAllowances,
  policy,
  monthDays,
  paymentDays,
  additionalExemptionsAnnual = 0,
}) {
  return useMemo(() => {
    const p = policy;
    const factor = clamp(paymentDays / Math.max(1, monthDays), 0, 1);

    // ----- Earnings split (full-month baseline)
    const basicFull = Math.round(monthlyGross * p.basicPctOfGross);
    const hraFull = Math.round(basicFull * p.hraPctOfBasic);
    const fixedFull = Math.round((fixedAllowances.conveyance || 0) + (fixedAllowances.medical || 0) + (fixedAllowances.lunch || 0));
    const specialFullRaw = monthlyGross - (basicFull + hraFull + fixedFull);
    const specialFull = Math.round(Math.max(0, specialFullRaw));

    // Flags
    const fixedTooHigh = specialFullRaw < 0;

    // Pro‑rated earnings for payment days (only Basic/HRA/Special)
    const basic = Math.round(basicFull * factor);
    const hra = Math.round(hraFull * factor);
    const special = Math.round(specialFull * factor);
    const conveyance = fixedAllowances.conveyance || 0; // not pro‑rated
    const medical = fixedAllowances.medical || 0;       // not pro‑rated
    const lunch = fixedAllowances.lunch || 0;           // not pro‑rated

    const monthlyGrossPayable = basic + hra + special + conveyance + medical + lunch;

    // ----- Deductions
    // PF base = Basic (by default), optionally capped by ceiling
    const pfBaseFull = basicFull;
    const pfBase = p.pf.restrictBaseToCeiling ? Math.min(pfBaseFull * factor, p.pf.wageCeiling) : pfBaseFull * factor;
    const pfEE = p.pf.apply ? Math.round(pfBase * p.pf.employeeRate) : 0;
    const vpfEE = p.pf.apply && p.pf.vpfRate > 0 ? Math.round(pfBase * p.pf.vpfRate) : 0;

    // ESI eligibility on full-month wages
    const esiEligible = p.esi.apply && monthlyGross <= p.esi.monthlyThreshold;
    const esiEE = esiEligible ? Math.round(monthlyGrossPayable * p.esi.employeeRate) : 0;

    // PT
    const pt = p.pt.apply ? Math.round(p.pt.monthlyAmount || 0) : 0;

    // ----- TDS (projection from annual gross)
    let tds = 0, annualTax = 0;
    if (p.tds.apply) {
      const annualGross = monthlyGross * 12;
      const stdDed = p.tds.standardDeduction || 0;
      const regime = p.tds.regime;
      const slabs = regime === "new" ? p.tds.slabsNew : p.tds.slabsOld;
      const allowedExemptions = regime === "new" ? 0 : (additionalExemptionsAnnual || 0);
      const taxable = Math.max(0, annualGross - stdDed - allowedExemptions);

      let taxCore = computeSlabTax(taxable, slabs);
      if (regime === "new" && taxable <= (p.tds.rebate87AThreshold || 0)) taxCore = 0;
      annualTax = Math.round(taxCore * (1 + (p.tds.cessRate || 0)));
      tds = Math.round(annualTax / 12);
    }

    const totalDeductions = pfEE + vpfEE + esiEE + pt + tds;
    const netPay = monthlyGrossPayable - totalDeductions;

    // Annualized views (using full-month numbers × 12; pro‑ration is monthly only)
    const annual = {
      earnings: {
        basic: basicFull * 12,
        hra: hraFull * 12,
        special: specialFull * 12,
        conveyance: (fixedAllowances.conveyance || 0) * 12,
        medical: (fixedAllowances.medical || 0) * 12,
        lunch: (fixedAllowances.lunch || 0) * 12,
      },
      gross: monthlyGross * 12,
      deductions: {
        pfEE: (p.pf.apply ? Math.round((p.pf.restrictBaseToCeiling ? Math.min(basicFull, p.pf.wageCeiling) : basicFull) * p.pf.employeeRate) : 0) * 12,
        vpfEE: (p.pf.apply && p.pf.vpfRate > 0 ? Math.round((p.pf.restrictBaseToCeiling ? Math.min(basicFull, p.pf.wageCeiling) : basicFull) * p.pf.vpfRate) : 0) * 12,
        esiEE: (p.esi.apply && monthlyGross <= p.esi.monthlyThreshold ? Math.round((basicFull + hraFull + specialFull + fixedFull) * p.esi.employeeRate) : 0) * 12,
        pt: (p.pt.apply ? Math.round(p.pt.monthlyAmount || 0) : 0) * 12,
        tds: tds * 12,
      },
    };
    const annualTotalDeductions = Object.values(annual.deductions).reduce((a,b)=>a+b,0);
    const annualNet = (basicFull + hraFull + specialFull + fixedFull) * 12 - annualTotalDeductions;

    return {
      flags: { negativeNet: netPay < 0, esiEligible, fixedTooHigh },
      factor,
      monthly: {
        earnings: { basic, hra, special, conveyance, medical, lunch },
        earningsFull: { basic: basicFull, hra: hraFull, special: specialFull, conveyance, medical, lunch },
        grossPayable: monthlyGrossPayable,
        deductions: { pfEE, vpfEE, esiEE, pt, tds },
        totalDeductions,
        netPay,
      },
      annual: {
        earnings: annual.earnings,
        gross: annual.gross,
        deductions: annual.deductions,
        totalDeductions: annualTotalDeductions,
        netPay: annualNet,
        taxProjected: annualTax,
      },
    };
  }, [monthlyGross, fixedAllowances, policy, monthDays, paymentDays, additionalExemptionsAnnual]);
}

export default function PayrollCalculator() {
  const [presets, setPresets] = useState(defaultPresets);
  const [employee, setEmployee] = useState("");
  const [inputMode, setInputMode] = useState("annual"); // "annual" | "monthly"
  const [annualGross, setAnnualGross] = useState(480000);
  const [grossMonthlyManual, setGrossMonthlyManual] = useState(40000);
  const monthlyGross = inputMode === "annual" ? (annualGross || 0) / 12 : (grossMonthlyManual || 0);

  const [fixed, setFixed] = useState({ conveyance: 1600, medical: 1250, lunch: 1150 });
  const [policy, setPolicy] = useState(defaultPolicy);
  const [monthDays, setMonthDays] = useState(30);
  const [paymentDays, setPaymentDays] = useState(30);
  const [additionalExemptionsAnnual, setAdditionalExemptionsAnnual] = useState(0);

  const result = usePayrollCalculator({ monthlyGross, fixedAllowances: fixed, policy, monthDays, paymentDays, additionalExemptionsAnnual });

  const loadPreset = (name) => {
    const p = presets.find((x) => x.name === name);
    if (!p) return;
    setEmployee(name);
    setInputMode("monthly");
    setGrossMonthlyManual(p.gross);
    setFixed(p.fixed);
  };

  const downloadJSON = (obj, filename) => {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportERPNextAssignment = () => {
    const payload = {
      employee: employee || "EMP-XXXX",
      salary_structure: "Monthly-Standard-2025",
      from_date: new Date().toISOString().slice(0,10),
      earnings: [
        { salary_component: "Basic", amount: result.monthly.earningsFull.basic },
        { salary_component: "HRA", amount: result.monthly.earningsFull.hra },
        { salary_component: "Special Allowance", amount: result.monthly.earningsFull.special },
        { salary_component: "Conveyance Allowance", amount: fixed.conveyance },
        { salary_component: "Medical Allowance", amount: fixed.medical },
        { salary_component: "Lunch Allowance", amount: fixed.lunch },
      ],
      deductions: [ { salary_component: "Income Tax (TDS)", amount: 0 } ],
      notes: "Auto-generated from CompWise-CTC Payroll Calculator (full-month amounts). TDS/PF/ESI/PT computed at Salary Slip time.",
    };
    downloadJSON(payload, `salary_assignment_${(employee||'employee').replaceAll(' ', '_')}.json`);
  };

  const resetPolicy = () => setPolicy(defaultPolicy);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-indigo-950 dark:to-purple-950 p-4 md:p-8">
      <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Config & Inputs */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-lg border-blue-200 dark:border-blue-800">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
              <CardTitle className="flex items-center gap-2 text-xl"><Calculator className="h-6 w-6"/> Payroll Inputs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div>
                <Label>Load Sample Employee</Label>
                <Select onValueChange={loadPreset}>
                  <SelectTrigger className="mt-1 border-blue-300 dark:border-blue-700"><SelectValue placeholder="Choose employee"/></SelectTrigger>
                  <SelectContent>
                    {presets.map(p => (
                      <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Input Mode</Label>
                <RadioGroup className="mt-2 grid grid-cols-2 gap-2" value={inputMode} onValueChange={setInputMode}>
                  <div className="flex items-center space-x-2 border rounded-lg p-2">
                    <RadioGroupItem value="annual" id="annual" />
                    <Label htmlFor="annual">Annual Gross</Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-2">
                    <RadioGroupItem value="monthly" id="monthly" />
                    <Label htmlFor="monthly">Monthly Gross</Label>
                  </div>
                </RadioGroup>
              </div>

              {inputMode === "annual" ? (
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label>Annual Gross (cash, Sub Total)</Label>
                    <Input type="number" value={annualGross} onChange={(e)=>setAnnualGross(parseFloat(e.target.value||0))} />
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Monthly Gross derived: <b>{rupees(monthlyGross)}</b></div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Monthly Gross (cash, Sub Total)</Label>
                    <Input type="number" value={grossMonthlyManual} onChange={(e)=>setGrossMonthlyManual(parseFloat(e.target.value||0))} />
                  </div>
                  <div className="flex items-end text-xs text-slate-500 dark:text-slate-400">Annual Gross derived: <b className="ml-1">{rupees(monthlyGross*12)}</b></div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Conveyance (monthly)</Label>
                  <Input type="number" value={fixed.conveyance} onChange={(e)=>setFixed(v=>({...v, conveyance: parseFloat(e.target.value||0)}))} />
                </div>
                <div>
                  <Label>Medical (monthly)</Label>
                  <Input type="number" value={fixed.medical} onChange={(e)=>setFixed(v=>({...v, medical: parseFloat(e.target.value||0)}))} />
                </div>
                <div>
                  <Label>Lunch (monthly)</Label>
                  <Input type="number" value={fixed.lunch} onChange={(e)=>setFixed(v=>({...v, lunch: parseFloat(e.target.value||0)}))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Month Days</Label>
                  <Input type="number" value={monthDays} onChange={(e)=>setMonthDays(parseInt(e.target.value||0))} />
                </div>
                <div>
                  <Label>Payment Days</Label>
                  <Input type="number" value={paymentDays} onChange={(e)=>setPaymentDays(parseInt(e.target.value||0))} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-orange-200 dark:border-orange-800">
            <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white flex items-center justify-between">
              <CardTitle>Policy Config</CardTitle>
              <Button variant="secondary" size="icon" onClick={resetPolicy} title="Reset"><RefreshCcw className="h-4 w-4"/></Button>
            </CardHeader>
            <CardContent className="space-y-5 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Basic % of Gross</Label>
                  <Slider defaultValue={[defaultPolicy.basicPctOfGross*100]} value={[policy.basicPctOfGross*100]} min={10} max={60} step={1}
                    onValueChange={(v)=>setPolicy(p=>({...p, basicPctOfGross: v[0]/100}))} />
                  <div className="text-sm mt-1">{pct(policy.basicPctOfGross)}</div>
                </div>
                <div>
                  <Label>HRA % of Basic</Label>
                  <Slider defaultValue={[defaultPolicy.hraPctOfBasic*100]} value={[policy.hraPctOfBasic*100]} min={30} max={60} step={1}
                    onValueChange={(v)=>setPolicy(p=>({...p, hraPctOfBasic: v[0]/100}))} />
                  <div className="text-sm mt-1">{pct(policy.hraPctOfBasic)}</div>
                </div>
              </div>

              <Tabs defaultValue="pf">
                <TabsList className="grid grid-cols-3">
                  <TabsTrigger value="pf">PF</TabsTrigger>
                  <TabsTrigger value="esi">ESI</TabsTrigger>
                  <TabsTrigger value="tds">TDS</TabsTrigger>
                </TabsList>
                <TabsContent value="pf" className="space-y-4 pt-3">
                  <div className="flex items-center justify-between">
                    <Label>Apply PF</Label>
                    <Switch checked={policy.pf.apply} onCheckedChange={(v)=>setPolicy(p=>({...p, pf: {...p.pf, apply: v}}))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Employee Rate (%)</Label>
                      <Input type="number" value={policy.pf.employeeRate*100}
                        onChange={(e)=>setPolicy(p=>({...p, pf:{...p.pf, employeeRate: parseFloat(e.target.value||0)/100}}))} />
                    </div>
                    <div>
                      <Label>VPF Rate (%)</Label>
                      <Input type="number" value={policy.pf.vpfRate*100}
                        onChange={(e)=>setPolicy(p=>({...p, pf:{...p.pf, vpfRate: parseFloat(e.target.value||0)/100}}))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Wage Ceiling</Label>
                      <Input type="number" value={policy.pf.wageCeiling}
                        onChange={(e)=>setPolicy(p=>({...p, pf:{...p.pf, wageCeiling: parseFloat(e.target.value||0)}}))} />
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <Switch checked={policy.pf.restrictBaseToCeiling}
                        onCheckedChange={(v)=>setPolicy(p=>({...p, pf:{...p.pf, restrictBaseToCeiling: v}}))} />
                      <Label>Restrict base to ceiling</Label>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="esi" className="space-y-4 pt-3">
                  <div className="flex items-center justify-between">
                    <Label>Apply ESI</Label>
                    <Switch checked={policy.esi.apply} onCheckedChange={(v)=>setPolicy(p=>({...p, esi: {...p.esi, apply: v}}))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Monthly Threshold</Label>
                      <Input type="number" value={policy.esi.monthlyThreshold}
                        onChange={(e)=>setPolicy(p=>({...p, esi:{...p.esi, monthlyThreshold: parseFloat(e.target.value||0)}}))} />
                    </div>
                    <div>
                      <Label>Employee Rate (%)</Label>
                      <Input type="number" value={policy.esi.employeeRate*100}
                        onChange={(e)=>setPolicy(p=>({...p, esi:{...p.esi, employeeRate: parseFloat(e.target.value||0)/100}}))} />
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="tds" className="space-y-4 pt-3">
                  <div className="flex items-center justify-between">
                    <Label>Apply TDS</Label>
                    <Switch checked={policy.tds.apply} onCheckedChange={(v)=>setPolicy(p=>({...p, tds: {...p.tds, apply: v}}))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Regime</Label>
                      <Select value={policy.tds.regime} onValueChange={(v)=>setPolicy(p=>({...p, tds:{...p.tds, regime: v}}))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New Regime</SelectItem>
                          <SelectItem value="old">Old Regime</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Std Deduction (₹)</Label>
                      <Input type="number" value={policy.tds.standardDeduction}
                        onChange={(e)=>setPolicy(p=>({...p, tds:{...p.tds, standardDeduction: parseFloat(e.target.value||0)}}))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>87A Rebate Threshold (₹)</Label>
                      <Input type="number" value={policy.tds.rebate87AThreshold}
                        onChange={(e)=>setPolicy(p=>({...p, tds:{...p.tds, rebate87AThreshold: parseFloat(e.target.value||0)}}))} />
                    </div>
                    <div>
                      <Label>Additional Exemptions (Annual, ₹)</Label>
                      <Input type="number" value={additionalExemptionsAnnual}
                        onChange={(e)=>setAdditionalExemptionsAnnual(parseFloat(e.target.value||0))} />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex gap-3">
                <Button onClick={exportERPNextAssignment} variant="secondary" className="gap-2"><Download className="h-4 w-4"/> Export ERPNext Assignment JSON</Button>
              </div>
            </CardContent>
          </Card>

          <EmployeeManager presets={presets} setPresets={setPresets} />
        </div>

        {/* Right Panel: Results */}
        <div className="lg:col-span-2 space-y-6">

          {/* Alerts */}
          {result.flags.fixedTooHigh && (
            <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/20">
              <CardHeader className="py-3"><CardTitle className="text-amber-800 dark:text-amber-400 text-base">Heads-up</CardTitle></CardHeader>
              <CardContent className="text-sm text-amber-800 dark:text-amber-400 -mt-3 pb-3">
                Your fixed allowances exceed what fits in the selected Gross after Basic & HRA. We've clamped <b>Special Allowance</b> to ₹0.
                Reduce fixed allowances or increase Gross for a balanced split.
              </CardContent>
            </Card>
          )}

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Standardized Split (Full Month) — Monthly & Annual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4 mb-4">
                <div className="p-4 border rounded-2xl">
                  <div className="text-sm text-slate-500 dark:text-slate-400">Gross (Monthly)</div>
                  <div className="text-2xl font-semibold">{rupees(monthlyGross)}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Annual: <b>{rupees(monthlyGross*12)}</b></div>
                </div>
                <div className="p-4 border rounded-2xl">
                  <div className="text-sm text-slate-500 dark:text-slate-400">Basic Share</div>
                  <div className="text-2xl font-semibold">{pct(policy.basicPctOfGross)}</div>
                </div>
                <div className="p-4 border rounded-2xl">
                  <div className="text-sm text-slate-500 dark:text-slate-400">HRA of Basic</div>
                  <div className="text-2xl font-semibold">{pct(policy.hraPctOfBasic)}</div>
                </div>
                <div className="p-4 border rounded-2xl">
                  <div className="text-sm text-slate-500 dark:text-slate-400">Payment Factor</div>
                  <div className="text-2xl font-semibold">{(result.factor*100).toFixed(1)}%</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2">Component</th>
                      <th className="py-2">Monthly</th>
                      <th className="py-2">Annual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { k:"Basic", m: result.monthly.earningsFull.basic, a: result.annual.earnings.basic },
                      { k:"HRA", m: result.monthly.earningsFull.hra, a: result.annual.earnings.hra },
                      { k:"Special Allowance", m: result.monthly.earningsFull.special, a: result.annual.earnings.special },
                      { k:"Conveyance", m: result.monthly.earningsFull.conveyance, a: result.annual.earnings.conveyance },
                      { k:"Medical", m: result.monthly.earningsFull.medical, a: result.annual.earnings.medical },
                      { k:"Lunch", m: result.monthly.earningsFull.lunch, a: result.annual.earnings.lunch },
                    ].map(row => (
                      <tr key={row.k} className="border-b">
                        <td className="py-2">{row.k}</td>
                        <td className="py-2 font-medium">{rupees(row.m)}</td>
                        <td className="py-2 font-medium">{rupees(row.a)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="py-2 font-semibold">Total Earnings</td>
                      <td className="py-2 font-semibold">{rupees(result.monthly.earningsFull.basic + result.monthly.earningsFull.hra + result.monthly.earningsFull.special + result.monthly.earningsFull.conveyance + result.monthly.earningsFull.medical + result.monthly.earningsFull.lunch)}</td>
                      <td className="py-2 font-semibold">{rupees(result.annual.earnings.basic + result.annual.earnings.hra + result.annual.earnings.special + result.annual.earnings.conveyance + result.annual.earnings.medical + result.annual.earnings.lunch)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Deductions & Net — Monthly & Annual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2">Deduction</th>
                      <th className="py-2">Monthly</th>
                      <th className="py-2">Annual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { k:"PF (Employee)", m: result.monthly.deductions.pfEE, a: result.annual.deductions.pfEE },
                      { k:"VPF (Employee)", m: result.monthly.deductions.vpfEE, a: result.annual.deductions.vpfEE },
                      { k:"ESI (Employee)", m: result.monthly.deductions.esiEE, a: result.annual.deductions.esiEE },
                      { k:"Professional Tax", m: result.monthly.deductions.pt, a: result.annual.deductions.pt },
                      { k:"TDS", m: result.monthly.deductions.tds, a: result.annual.deductions.tds },
                    ].map(row => (
                      <tr key={row.k} className="border-b">
                        <td className="py-2">{row.k}</td>
                        <td className="py-2 font-medium">{rupees(row.m)}</td>
                        <td className="py-2 font-medium">{rupees(row.a)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="py-2 font-semibold">Total Deductions</td>
                      <td className="py-2 font-semibold">{rupees(result.monthly.totalDeductions)}</td>
                      <td className="py-2 font-semibold">{rupees(result.annual.totalDeductions)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-semibold">Net Pay</td>
                      <td className={"py-2 font-semibold "+(result.flags.negativeNet?"text-red-600":"text-emerald-700")}>{rupees(result.monthly.netPay)}</td>
                      <td className="py-2 font-semibold">{rupees(result.annual.netPay)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">TDS is a projection based on current policy (slabs/cess/rebate) and uses Annual Gross; actual monthly TDS in ERPNext should equalize with YTD.</div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Formula Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-2 list-disc ml-5">
                <li><b>Basic</b> = Gross × Basic% (default {pct(defaultPolicy.basicPctOfGross)})</li>
                <li><b>HRA</b> = Basic × HRA% (default {pct(defaultPolicy.hraPctOfBasic)})</li>
                <li><b>Special</b> = Gross − (Basic + HRA + Fixed allowances). If negative, Special is clamped to ₹0 and a warning is shown.</li>
                <li><b>Pro‑ration</b> applies only to Basic/HRA/Special using PaymentDays/MonthDays. Annual view uses full‑month values × 12.</li>
                <li><b>PF/ESI/PT</b> computed monthly; annual = 12× monthly.</li>
                <li><b>TDS</b> computed from annual slabs with 4% cess and divided over 12 for monthly.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
