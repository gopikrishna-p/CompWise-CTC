import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { UserPlus, Trash2, Users } from 'lucide-react';

const EmployeeManager = ({ presets, setPresets }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [inputMode, setInputMode] = useState('monthly');
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    monthlyGross: 40000,
    annualGross: 480000,
    conveyance: 1600,
    medical: 1250,
    lunch: 1150,
  });

  const addEmployee = () => {
    if (!newEmployee.name.trim()) {
      alert('Please enter employee name');
      return;
    }
    
    const grossAmount = inputMode === 'monthly' 
      ? parseFloat(newEmployee.monthlyGross) || 0
      : parseFloat(newEmployee.annualGross) / 12 || 0;
    
    setPresets([
      ...presets,
      {
        name: newEmployee.name,
        gross: grossAmount,
        fixed: {
          conveyance: parseFloat(newEmployee.conveyance) || 0,
          medical: parseFloat(newEmployee.medical) || 0,
          lunch: parseFloat(newEmployee.lunch) || 0,
        },
      },
    ]);
    setNewEmployee({
      name: '',
      monthlyGross: 40000,
      annualGross: 480000,
      conveyance: 1600,
      medical: 1250,
      lunch: 1150,
    });
    setShowAddForm(false);
  };

  const handleMonthlyChange = (value) => {
    const monthly = parseFloat(value) || 0;
    setNewEmployee({
      ...newEmployee,
      monthlyGross: monthly,
      annualGross: monthly * 12,
    });
  };

  const handleAnnualChange = (value) => {
    const annual = parseFloat(value) || 0;
    setNewEmployee({
      ...newEmployee,
      annualGross: annual,
      monthlyGross: annual / 12,
    });
  };

  const removeEmployee = (name) => {
    if (window.confirm(`Remove ${name} from presets?`)) {
      setPresets(presets.filter((p) => p.name !== name));
    }
  };

  return (
    <Card className="shadow-lg border-purple-200 dark:border-purple-800">
      <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-600 text-white">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <span>Manage Employees</span>
          </div>
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            size="sm"
            variant="secondary"
          >
            <UserPlus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {showAddForm && (
          <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
            <div className="space-y-3">
              <div>
                <Label>Employee Name</Label>
                <Input
                  value={newEmployee.name}
                  onChange={(e) =>
                    setNewEmployee({ ...newEmployee, name: e.target.value })
                  }
                  placeholder="John Doe"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label>Salary Input Mode</Label>
                <RadioGroup 
                  className="mt-2 grid grid-cols-2 gap-2" 
                  value={inputMode} 
                  onValueChange={setInputMode}
                >
                  <div className="flex items-center space-x-2 border-2 border-purple-300 dark:border-purple-700 rounded-lg p-2">
                    <RadioGroupItem value="monthly" id="emp-monthly" />
                    <Label htmlFor="emp-monthly">Monthly</Label>
                  </div>
                  <div className="flex items-center space-x-2 border-2 border-purple-300 dark:border-purple-700 rounded-lg p-2">
                    <RadioGroupItem value="annual" id="emp-annual" />
                    <Label htmlFor="emp-annual">Annual</Label>
                  </div>
                </RadioGroup>
              </div>

              {inputMode === 'monthly' ? (
                <div>
                  <Label>Monthly Gross (₹)</Label>
                  <Input
                    type="number"
                    value={newEmployee.monthlyGross}
                    onChange={(e) => handleMonthlyChange(e.target.value)}
                    className="mt-1"
                  />
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Annual: ₹{Math.round(newEmployee.annualGross).toLocaleString('en-IN')}
                  </div>
                </div>
              ) : (
                <div>
                  <Label>Annual Gross (₹)</Label>
                  <Input
                    type="number"
                    value={newEmployee.annualGross}
                    onChange={(e) => handleAnnualChange(e.target.value)}
                    className="mt-1"
                  />
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Monthly: ₹{Math.round(newEmployee.monthlyGross).toLocaleString('en-IN')}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Conveyance</Label>
                  <Input
                    type="number"
                    value={newEmployee.conveyance}
                    onChange={(e) =>
                      setNewEmployee({
                        ...newEmployee,
                        conveyance: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Medical</Label>
                  <Input
                    type="number"
                    value={newEmployee.medical}
                    onChange={(e) =>
                      setNewEmployee({
                        ...newEmployee,
                        medical: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Lunch</Label>
                  <Input
                    type="number"
                    value={newEmployee.lunch}
                    onChange={(e) =>
                      setNewEmployee({
                        ...newEmployee,
                        lunch: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button onClick={addEmployee} className="flex-1 bg-green-600 hover:bg-green-700">
                Add Employee
              </Button>
              <Button
                onClick={() => setShowAddForm(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {presets.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
              No employees added yet. Click "Add" to get started.
            </p>
          ) : (
            presets.map((preset) => (
              <div
                key={preset.name}
                className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">
                    {preset.name}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    Monthly: ₹{preset.gross.toLocaleString('en-IN')} | Annual: ₹{(preset.gross * 12).toLocaleString('en-IN')}
                  </div>
                </div>
                <Button
                  onClick={() => removeEmployee(preset.name)}
                  variant="ghost"
                  size="icon"
                  className="text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                  data-testid={`remove-employee-${preset.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EmployeeManager;
