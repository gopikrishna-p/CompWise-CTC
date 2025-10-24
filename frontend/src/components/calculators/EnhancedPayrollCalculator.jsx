"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Download, Calculator, RefreshCcw, FileDown, TrendingUp, Wallet, Sun, Moon, Plus, X } from "lucide-react";
import EmployeeManager from "./EmployeeManager";
import { useTheme } from '@/contexts/ThemeContext';

// ---------- Helpers ----------
const rupees = (n) => (Number.isFinite(n) ? `₹${Math.round(n).toLocaleString("en-IN")}` : "₹0");
const pct = (n) => `${(n * 100).toFixed(1)}%`;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const toNum = (val, fallback = 0) => {
  const n = typeof val === "number" ? val : parseFloat(val);
  return Number.isFinite(n) ? n : fallback;
};

// Default policy
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

// Default presets - Pulicharla Gopi Krishna as default
const defaultPresets = [
  { name: "Pulicharla Gopi Krishna", gross: 50000, fixed: { conveyance: 1300, medical: 1200, lunch: 1500 } },
];

// ---------- Core calculations (pure) ----------
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

function calculatePayroll({
  monthlyGross,
  fixedAllowances,
  policy,
  monthDays,
  paymentDays,
  additionalExemptionsAnnual = 0,
  customEarnings = [],
  customDeductions = [],
}) {
  const p = policy;
  const factor = clamp(paymentDays / Math.max(1, monthDays), 0, 1);

  const basicFull = Math.round(monthlyGross * p.basicPctOfGross);
  const hraFull = Math.round(basicFull * p.hraPctOfBasic);
  const fixedFull = Math.round((fixedAllowances.conveyance || 0) + (fixedAllowances.medical || 0) + (fixedAllowances.lunch || 0));
  const specialFullRaw = monthlyGross - (basicFull + hraFull + fixedFull);
  const specialFull = Math.round(Math.max(0, specialFullRaw));
  const fixedTooHigh = specialFullRaw < 0;

  const basic = Math.round(basicFull * factor);
  const hra = Math.round(hraFull * factor);
  const special = Math.round(specialFull * factor);
  const conveyance = fixedAllowances.conveyance || 0;
  const medical = fixedAllowances.medical || 0;
  const lunch = fixedAllowances.lunch || 0;

  // Add custom earnings to gross payable
  const customEarningsTotal = customEarnings.reduce((sum, item) => sum + (item.amount || 0), 0);
  const monthlyGrossPayable = basic + hra + special + conveyance + medical + lunch + customEarningsTotal;

  const pfBaseFull = basicFull;
  const pfBase = p.pf.restrictBaseToCeiling ? Math.min(pfBaseFull * factor, p.pf.wageCeiling) : pfBaseFull * factor;
  const pfEE = p.pf.apply ? Math.round(pfBase * p.pf.employeeRate) : 0;
  const vpfEE = p.pf.apply && p.pf.vpfRate > 0 ? Math.round(pfBase * p.pf.vpfRate) : 0;

  const esiEligible = p.esi.apply && monthlyGross <= p.esi.monthlyThreshold;
  const esiEE = esiEligible ? Math.round(monthlyGrossPayable * p.esi.employeeRate) : 0;

  const pt = p.pt.apply ? Math.round(p.pt.monthlyAmount || 0) : 0;

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

  // Add custom deductions
  const customDeductionsTotal = customDeductions.reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalDeductions = pfEE + vpfEE + esiEE + pt + tds + customDeductionsTotal;
  const netPay = monthlyGrossPayable - totalDeductions;

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
  const annualTotalDeductions = Object.values(annual.deductions).reduce((a,b)=>a+b,0) + (customDeductionsTotal * 12);
  const annualNet = (basicFull + hraFull + specialFull + fixedFull + customEarningsTotal) * 12 - annualTotalDeductions;

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
      customEarnings,
      customDeductions,
      customEarningsTotal,
      customDeductionsTotal,
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
}

function usePayrollCalculator(args) {
  return useMemo(() => calculatePayroll(args), [
    args.monthlyGross,
    args.fixedAllowances,
    args.policy,
    args.monthDays,
    args.paymentDays,
    args.additionalExemptionsAnnual,
    args.customEarnings,
    args.customDeductions,
  ]);
}

export default function EnhancedPayrollCalculator() {
  const { theme, toggleTheme } = useTheme();
  const [presets, setPresets] = useState(defaultPresets);
  const [employee, setEmployee] = useState("Pulicharla Gopi Krishna");
  const [inputMode, setInputMode] = useState("annual");
  const [annualGross, setAnnualGross] = useState(600000); // 6 LPA
  const [grossMonthlyManual, setGrossMonthlyManual] = useState(50000);
  const monthlyGross = inputMode === "annual" ? toNum(annualGross) / 12 : toNum(grossMonthlyManual);

  const [fixed, setFixed] = useState({ conveyance: 1300, medical: 1200, lunch: 1500 });
  const [policy, setPolicy] = useState(defaultPolicy);
  const [monthDays, setMonthDays] = useState(30);
  const [paymentDays, setPaymentDays] = useState(30);
  const [additionalExemptionsAnnual, setAdditionalExemptionsAnnual] = useState(0);

  // Custom components
  const [customEarnings, setCustomEarnings] = useState([]);
  const [customDeductions, setCustomDeductions] = useState([]);
  const [newEarning, setNewEarning] = useState({ name: "", amount: 0 });
  const [newDeduction, setNewDeduction] = useState({ name: "", amount: 0 });
  const [showAddEarning, setShowAddEarning] = useState(false);
  const [showAddDeduction, setShowAddDeduction] = useState(false);

  // Load default employee on mount
  useEffect(() => {
    loadPreset("Pulicharla Gopi Krishna");
  }, []);

  const result = usePayrollCalculator({ 
    monthlyGross, 
    fixedAllowances: fixed, 
    policy, 
    monthDays, 
    paymentDays, 
    additionalExemptionsAnnual,
    customEarnings,
    customDeductions,
  });

  const resultsRef = useRef(null);
  const handleDownloadPDF = async () => {
    const element = resultsRef.current;
    if (!element) {
      console.warn("[PDF] No element found for PDF generation");
      return;
    }
    try {
      const mod = await import("html2pdf.js");
      const html2pdf = mod?.default || mod;
      const safeName = (employee || "payroll").replace(/\s+/g, "_");
      const opts = {
        margin: [3, 3, 3, 3],
        filename: `Payroll_${safeName}.pdf`,
        image: { type: "jpeg", quality: 0.85 },
        html2canvas: { 
          scale: 1.2,
          useCORS: true, 
          scrollY: 0,
          windowHeight: element.scrollHeight
        },
        jsPDF: { 
          unit: "mm", 
          format: "a4", 
          orientation: "portrait",
          compress: true
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      };
      await html2pdf().set(opts).from(element).save();
    } catch (err) {
      console.error("[PDF] Failed to export:", err);
      alert("PDF export failed. Check console for details.");
    }
  };

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
        ...customEarnings.map(ce => ({ salary_component: ce.name, amount: ce.amount })),
      ],
      deductions: [
        { salary_component: "Income Tax (TDS)", amount: 0 },
        ...customDeductions.map(cd => ({ salary_component: cd.name, amount: cd.amount })),
      ],
      notes: "Auto-generated from CompWise-CTC Payroll Calculator.",
    };
    const safeName = (employee||"employee").replace(/\s+/g, "_");
    downloadJSON(payload, `salary_assignment_${safeName}.json`);
  };

  const resetPolicy = () => setPolicy(defaultPolicy);

  const addCustomEarning = () => {
    if (!newEarning.name.trim()) {
      alert("Please enter earning name");
      return;
    }
    setCustomEarnings([...customEarnings, { ...newEarning, id: Date.now() }]);
    setNewEarning({ name: "", amount: 0 });
    setShowAddEarning(false);
  };

  const removeCustomEarning = (id) => {
    setCustomEarnings(customEarnings.filter(e => e.id !== id));
  };

  const addCustomDeduction = () => {
    if (!newDeduction.name.trim()) {
      alert("Please enter deduction name");
      return;
    }
    setCustomDeductions([...customDeductions, { ...newDeduction, id: Date.now() }]);
    setNewDeduction({ name: "", amount: 0 });
    setShowAddDeduction(false);
  };

  const removeCustomDeduction = (id) => {
    setCustomDeductions(customDeductions.filter(d => d.id !== id));
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-indigo-950 dark:to-purple-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
              <Calculator className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">CompWise-CTC Payroll</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Advanced CTC Calculator</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={toggleTheme}
            className="gap-2"
            data-testid="theme-toggle-btn"
          >
            {theme === 'light' ? (
              <>
                <Moon className="h-4 w-4" />
                <span className="hidden sm:inline">Dark</span>
              </>
            ) : (
              <>
                <Sun className="h-4 w-4" />
                <span className="hidden sm:inline">Light</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="p-4 md:p-8">
        <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Input Cards */}
          <div className="space-y-6">
            <Card className="shadow-lg border-blue-200 dark:border-blue-800">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Calculator className="h-6 w-6"/> Payroll Inputs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div>
                  <Label>Employee</Label>
                  <Select value={employee} onValueChange={loadPreset}>
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
                    <div className="flex items-center space-x-2 border-2 border-blue-300 dark:border-blue-700 rounded-lg p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                      <RadioGroupItem value="annual" id="annual" />
                      <Label htmlFor="annual">Annual</Label>
                    </div>
                    <div className="flex items-center space-x-2 border-2 border-blue-300 dark:border-blue-700 rounded-lg p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                      <RadioGroupItem value="monthly" id="monthly" />
                      <Label htmlFor="monthly">Monthly</Label>
                    </div>
                  </RadioGroup>
                </div>

                {inputMode === "annual" ? (
                  <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-300 dark:border-green-700">
                    <Label className="text-green-800 dark:text-green-300">Annual Gross (₹)</Label>
                    <Input type="number" value={annualGross} onChange={(e)=>setAnnualGross(toNum(e.target.value, 0))} className="mt-1 border-green-300 dark:border-green-700" />
                    <div className="text-xs text-green-700 dark:text-green-400 mt-1">Monthly: <b>{rupees(monthlyGross)}</b></div>
                  </div>
                ) : (
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-300 dark:border-blue-700">
                    <Label className="text-blue-800 dark:text-blue-300">Monthly Gross (₹)</Label>
                    <Input type="number" value={grossMonthlyManual} onChange={(e)=>setGrossMonthlyManual(toNum(e.target.value, 0))} className="mt-1 border-blue-300 dark:border-blue-700" />
                    <div className="text-xs text-blue-700 dark:text-blue-400 mt-1">Annual: <b>{rupees(monthlyGross*12)}</b></div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Conveyance</Label>
                    <Input type="number" value={fixed.conveyance} onChange={(e)=>setFixed(v=>({...v, conveyance: toNum(e.target.value, 0)}))} className="text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Medical</Label>
                    <Input type="number" value={fixed.medical} onChange={(e)=>setFixed(v=>({...v, medical: toNum(e.target.value, 0)}))} className="text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Lunch</Label>
                    <Input type="number" value={fixed.lunch} onChange={(e)=>setFixed(v=>({...v, lunch: toNum(e.target.value, 0)}))} className="text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Month Days</Label>
                    <Input type="number" value={monthDays} onChange={(e)=>setMonthDays(Math.max(1, Math.round(toNum(e.target.value, 30))))} />
                  </div>
                  <div>
                    <Label>Payment Days</Label>
                    <Input type="number" value={paymentDays} onChange={(e)=>setPaymentDays(Math.max(0, Math.min(Math.round(toNum(e.target.value, 30)), monthDays)))} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Custom Earnings */}
            <Card className="shadow-lg border-green-200 dark:border-green-800">
              <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Custom Earnings</span>
                  <Button size="sm" variant="secondary" onClick={() => setShowAddEarning(!showAddEarning)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {showAddEarning && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-300 dark:border-green-700 space-y-2">
                    <Input placeholder="Name" value={newEarning.name} onChange={(e) => setNewEarning({...newEarning, name: e.target.value})} />
                    <Input type="number" placeholder="Amount" value={newEarning.amount} onChange={(e) => setNewEarning({...newEarning, amount: toNum(e.target.value, 0)})} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={addCustomEarning} className="flex-1">Add</Button>
                      <Button size="sm" variant="outline" onClick={() => setShowAddEarning(false)} className="flex-1">Cancel</Button>
                    </div>
                  </div>
                )}
                {customEarnings.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-2">No custom earnings</p>
                ) : (
                  <div className="space-y-2">
                    {customEarnings.map(e => (
                      <div key={e.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div>
                          <div className="text-sm font-medium">{e.name}</div>
                          <div className="text-xs text-slate-500">{rupees(e.amount)}</div>
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => removeCustomEarning(e.id)}>
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Custom Deductions */}
            <Card className="shadow-lg border-red-200 dark:border-red-800">
              <CardHeader className="bg-gradient-to-r from-red-500 to-pink-600 text-white">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Custom Deductions</span>
                  <Button size="sm" variant="secondary" onClick={() => setShowAddDeduction(!showAddDeduction)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {showAddDeduction && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-300 dark:border-red-700 space-y-2">
                    <Input placeholder="Name" value={newDeduction.name} onChange={(e) => setNewDeduction({...newDeduction, name: e.target.value})} />
                    <Input type="number" placeholder="Amount" value={newDeduction.amount} onChange={(e) => setNewDeduction({...newDeduction, amount: toNum(e.target.value, 0)})} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={addCustomDeduction} className="flex-1">Add</Button>
                      <Button size="sm" variant="outline" onClick={() => setShowAddDeduction(false)} className="flex-1">Cancel</Button>
                    </div>
                  </div>
                )}
                {customDeductions.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-2">No custom deductions</p>
                ) : (
                  <div className="space-y-2">
                    {customDeductions.map(d => (
                      <div key={d.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div>
                          <div className="text-sm font-medium">{d.name}</div>
                          <div className="text-xs text-slate-500">{rupees(d.amount)}</div>
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => removeCustomDeduction(d.id)}>
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <EmployeeManager presets={presets} setPresets={setPresets} />
          </div>

          {/* Right Panel - Policy & Results */}
          <div className="space-y-6">
            {/* Policy Config Card */}
            <Card className="shadow-lg border-orange-200 dark:border-orange-800">
              <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white flex items-center justify-between">
                <CardTitle>Policy Config</CardTitle>
                <Button variant="secondary" size="icon" onClick={resetPolicy} title="Reset"><RefreshCcw className="h-4 w-4"/></Button>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Basic % of Gross</Label>
                    <Slider value={[policy.basicPctOfGross*100]} min={10} max={60} step={1}
                      onValueChange={(v)=>setPolicy(p=>({...p, basicPctOfGross: v[0]/100}))} className="my-2" />
                    <div className="text-sm font-semibold text-center text-blue-600 dark:text-blue-400">{pct(policy.basicPctOfGross)}</div>
                  </div>
                  <div>
                    <Label>HRA % of Basic</Label>
                    <Slider value={[policy.hraPctOfBasic*100]} min={30} max={60} step={1}
                      onValueChange={(v)=>setPolicy(p=>({...p, hraPctOfBasic: v[0]/100}))} className="my-2" />
                    <div className="text-sm font-semibold text-center text-green-600 dark:text-green-400">{pct(policy.hraPctOfBasic)}</div>
                  </div>
                </div>

                <Tabs defaultValue="pf">
                  <TabsList className="grid grid-cols-4 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/40 dark:to-pink-900/40">
                    <TabsTrigger value="pf">PF</TabsTrigger>
                    <TabsTrigger value="esi">ESI</TabsTrigger>
                    <TabsTrigger value="pt">PT</TabsTrigger>
                    <TabsTrigger value="tds">TDS</TabsTrigger>
                  </TabsList>
                  <TabsContent value="pf" className="space-y-3 pt-3">
                    <div className="flex items-center justify-between">
                      <Label>Apply PF</Label>
                      <Switch checked={policy.pf.apply} onCheckedChange={(v)=>setPolicy(p=>({...p, pf: {...p.pf, apply: v}}))} />
                    </div>
                    {policy.pf.apply && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Employee Rate (%)</Label>
                            <Input type="number" value={Math.round(policy.pf.employeeRate*10000)/100}
                              onChange={(e)=>setPolicy(p=>({...p, pf:{...p.pf, employeeRate: toNum(e.target.value, 0)/100}}))} className="text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs">VPF Rate (%)</Label>
                            <Input type="number" value={Math.round(policy.pf.vpfRate*10000)/100}
                              onChange={(e)=>setPolicy(p=>({...p, pf:{...p.pf, vpfRate: toNum(e.target.value, 0)/100}}))} className="text-sm" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Wage Ceiling</Label>
                            <Input type="number" value={policy.pf.wageCeiling}
                              onChange={(e)=>setPolicy(p=>({...p, pf:{...p.pf, wageCeiling: Math.max(0, Math.round(toNum(e.target.value, p.pf.wageCeiling)))}}))} className="text-sm" />
                          </div>
                          <div className="flex items-center gap-2 pt-5">
                            <Switch checked={policy.pf.restrictBaseToCeiling}
                              onCheckedChange={(v)=>setPolicy(p=>({...p, pf:{...p.pf, restrictBaseToCeiling: v}}))} />
                            <Label className="text-xs">Restrict to ceiling</Label>
                          </div>
                        </div>
                      </>
                    )}
                  </TabsContent>
                  <TabsContent value="esi" className="space-y-3 pt-3">
                    <div className="flex items-center justify-between">
                      <Label>Apply ESI</Label>
                      <Switch checked={policy.esi.apply} onCheckedChange={(v)=>setPolicy(p=>({...p, esi: {...p.esi, apply: v}}))} />
                    </div>
                    {policy.esi.apply && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Monthly Threshold</Label>
                          <Input type="number" value={policy.esi.monthlyThreshold}
                            onChange={(e)=>setPolicy(p=>({...p, esi:{...p.esi, monthlyThreshold: Math.max(0, Math.round(toNum(e.target.value, p.esi.monthlyThreshold)))}}))} className="text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">Employee Rate (%)</Label>
                          <Input type="number" value={Math.round(policy.esi.employeeRate*10000)/100}
                            onChange={(e)=>setPolicy(p=>({...p, esi:{...p.esi, employeeRate: toNum(e.target.value, 0)/100}}))} className="text-sm" />
                        </div>
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="pt" className="space-y-3 pt-3">
                    <div className="flex items-center justify-between">
                      <Label>Apply Professional Tax</Label>
                      <Switch checked={policy.pt.apply} onCheckedChange={(v)=>setPolicy(p=>({...p, pt: {...p.pt, apply: v}}))} />
                    </div>
                    {policy.pt.apply && (
                      <div>
                        <Label className="text-xs">Monthly Amount (₹)</Label>
                        <Input type="number" value={policy.pt.monthlyAmount}
                          onChange={(e)=>setPolicy(p=>({...p, pt:{...p.pt, monthlyAmount: Math.max(0, Math.round(toNum(e.target.value, p.pt.monthlyAmount)))}}))} className="text-sm mt-1" />
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="tds" className="space-y-3 pt-3">
                    <div className="flex items-center justify-between">
                      <Label>Apply TDS</Label>
                      <Switch checked={policy.tds.apply} onCheckedChange={(v)=>setPolicy(p=>({...p, tds: {...p.tds, apply: v}}))} />
                    </div>
                    {policy.tds.apply && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Regime</Label>
                            <Select value={policy.tds.regime} onValueChange={(v)=>setPolicy(p=>({...p, tds:{...p.tds, regime: v}}))}>
                              <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new">New Regime</SelectItem>
                                <SelectItem value="old">Old Regime</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Std Deduction</Label>
                            <Input type="number" value={policy.tds.standardDeduction}
                              onChange={(e)=>setPolicy(p=>({...p, tds:{...p.tds, standardDeduction: Math.max(0, Math.round(toNum(e.target.value, p.tds.standardDeduction)))}}))} className="text-sm" />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Additional Exemptions (Annual)</Label>
                          <Input type="number" value={additionalExemptionsAnnual}
                            onChange={(e)=>setAdditionalExemptionsAnnual(Math.max(0, Math.round(toNum(e.target.value, 0))))} className="text-sm mt-1" />
                        </div>
                      </>
                    )}
                  </TabsContent>
                </Tabs>

                <div className="flex gap-2 flex-wrap">
                  <Button onClick={exportERPNextAssignment} variant="secondary" size="sm" className="gap-1 text-xs"><Download className="h-3 w-3"/> Export JSON</Button>
                  <Button onClick={handleDownloadPDF} size="sm" className="gap-1 text-xs bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600"><FileDown className="h-3 w-3"/> Download PDF</Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Results Section */}
            <div ref={resultsRef} className="space-y-4">
              {result.flags.fixedTooHigh && (
              <Card className="border-amber-400 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 shadow-lg">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-500 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-amber-900 dark:text-amber-300">Fixed Allowances Too High</div>
                      <div className="text-sm text-amber-800 dark:text-amber-400 mt-1">
                        Your fixed allowances exceed available gross after Basic & HRA. Special Allowance clamped to ₹0.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="shadow-xl border-indigo-200 dark:border-indigo-800">
              <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                <CardTitle className="flex items-center gap-2"><Wallet className="h-6 w-6"/> Salary Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid md:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/40 rounded-xl border-2 border-blue-300 dark:border-blue-700">
                    <div className="text-xs text-blue-700 dark:text-blue-300 font-semibold">Gross Monthly</div>
                    <div className="text-xl font-bold text-blue-900 dark:text-blue-100">{rupees(monthlyGross)}</div>
                    <div className="text-[10px] text-blue-600 dark:text-blue-400">Annual: {rupees(monthlyGross*12)}</div>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/40 dark:to-green-800/40 rounded-xl border-2 border-green-300 dark:border-green-700">
                    <div className="text-xs text-green-700 dark:text-green-300 font-semibold">Basic Share</div>
                    <div className="text-xl font-bold text-green-900 dark:text-green-100">{pct(policy.basicPctOfGross)}</div>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/40 dark:to-purple-800/40 rounded-xl border-2 border-purple-300 dark:border-purple-700">
                    <div className="text-xs text-purple-700 dark:text-purple-300 font-semibold">HRA of Basic</div>
                    <div className="text-xl font-bold text-purple-900 dark:text-purple-100">{pct(policy.hraPctOfBasic)}</div>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/40 dark:to-orange-800/40 rounded-xl border-2 border-orange-300 dark:border-orange-700">
                    <div className="text-xs text-orange-700 dark:text-orange-300 font-semibold">Payment Factor</div>
                    <div className="text-xl font-bold text-orange-900 dark:text-orange-100">{(result.factor*100).toFixed(1)}%</div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700">
                        <th className="py-2 px-3 text-left font-semibold">Component</th>
                        <th className="py-2 px-3 text-right font-semibold">Monthly</th>
                        <th className="py-2 px-3 text-right font-semibold">Annual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { k:"Basic", m: result.monthly.earningsFull.basic, a: result.annual.earnings.basic },
                        { k:"HRA", m: result.monthly.earningsFull.hra, a: result.annual.earnings.hra },
                        { k:"Special", m: result.monthly.earningsFull.special, a: result.annual.earnings.special },
                        { k:"Conveyance", m: result.monthly.earningsFull.conveyance, a: result.annual.earnings.conveyance },
                        { k:"Medical", m: result.monthly.earningsFull.medical, a: result.annual.earnings.medical },
                        { k:"Lunch", m: result.monthly.earningsFull.lunch, a: result.annual.earnings.lunch },
                        ...customEarnings.map(ce => ({ k: ce.name, m: ce.amount, a: ce.amount * 12 })),
                      ].map((row, idx) => (
                        <tr key={row.k} className={`border-b ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                          <td className="py-2 px-3">{row.k}</td>
                          <td className="py-2 px-3 text-right font-semibold">{rupees(row.m)}</td>
                          <td className="py-2 px-3 text-right font-semibold">{rupees(row.a)}</td>
                        </tr>
                      ))}
                      <tr className="bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 font-bold">
                        <td className="py-2 px-3">Total Earnings</td>
                        <td className="py-2 px-3 text-right">{rupees(result.monthly.grossPayable)}</td>
                        <td className="py-2 px-3 text-right">{rupees((result.monthly.earningsFull.basic + result.monthly.earningsFull.hra + result.monthly.earningsFull.special + result.monthly.earningsFull.conveyance + result.monthly.earningsFull.medical + result.monthly.earningsFull.lunch + result.monthly.customEarningsTotal) * 12)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xl border-red-200 dark:border-red-800">
              <CardHeader className="bg-gradient-to-r from-red-500 to-pink-600 text-white">
                <CardTitle>Deductions & Net Pay</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-900/40 dark:to-pink-900/40">
                        <th className="py-2 px-3 text-left font-semibold">Deduction</th>
                        <th className="py-2 px-3 text-right font-semibold">Monthly</th>
                        <th className="py-2 px-3 text-right font-semibold">Annual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { k:"PF (Employee)", m: result.monthly.deductions.pfEE, a: result.annual.deductions.pfEE, show: policy.pf.apply },
                        { k:"VPF (Employee)", m: result.monthly.deductions.vpfEE, a: result.annual.deductions.vpfEE, show: policy.pf.apply && policy.pf.vpfRate > 0 },
                        { k:"ESI (Employee)", m: result.monthly.deductions.esiEE, a: result.annual.deductions.esiEE, show: policy.esi.apply },
                        { k:"Professional Tax", m: result.monthly.deductions.pt, a: result.annual.deductions.pt, show: policy.pt.apply },
                        { k:"TDS", m: result.monthly.deductions.tds, a: result.annual.deductions.tds, show: policy.tds.apply },
                        ...customDeductions.map(cd => ({ k: cd.name, m: cd.amount, a: cd.amount * 12, show: true })),
                      ].filter(row => row.show).map((row, idx) => (
                        <tr key={row.k} className={`border-b ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                          <td className="py-2 px-3">{row.k}</td>
                          <td className="py-2 px-3 text-right font-semibold">{rupees(row.m)}</td>
                          <td className="py-2 px-3 text-right font-semibold">{rupees(row.a)}</td>
                        </tr>
                      ))}
                      <tr className="bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-900/40 dark:to-pink-900/40 font-bold">
                        <td className="py-2 px-3">Total Deductions</td>
                        <td className="py-2 px-3 text-right">{rupees(result.monthly.totalDeductions)}</td>
                        <td className="py-2 px-3 text-right">{rupees(result.annual.totalDeductions)}</td>
                      </tr>
                      <tr className="bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-900/40 dark:to-green-900/40 font-bold text-lg">
                        <td className="py-3 px-3">Net Pay</td>
                        <td className={"py-3 px-3 text-right "+(result.flags.negativeNet?"text-red-600 dark:text-red-400":"text-emerald-700 dark:text-emerald-400")}>{rupees(result.monthly.netPay)}</td>
                        <td className="py-3 px-3 text-right text-emerald-700 dark:text-emerald-400">{rupees(result.annual.netPay)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-slate-200 dark:border-slate-700">
              <CardHeader className="bg-gradient-to-r from-slate-500 to-slate-700 text-white">
                <CardTitle className="text-base">Formula Notes</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ul className="text-xs space-y-1 list-disc ml-4 text-slate-700 dark:text-slate-300">
                  <li><b>Basic</b> = Gross × {pct(defaultPolicy.basicPctOfGross)}</li>
                  <li><b>HRA</b> = Basic × {pct(defaultPolicy.hraPctOfBasic)}</li>
                  <li><b>Special</b> = Gross − (Basic + HRA + Fixed allowances)</li>
                  <li><b>Pro‑ration</b> applies only to Basic/HRA/Special</li>
                  <li><b>Deductions</b> apply based on toggle switches (PF, ESI, PT, TDS)</li>
                  <li><b>TDS</b> computed from annual slabs with 4% cess</li>
                </ul>
              </CardContent>
            </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
