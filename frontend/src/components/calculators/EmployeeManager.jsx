import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, Trash2, Users } from 'lucide-react';

const EmployeeManager = ({ presets, setPresets }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    gross: 40000,
    conveyance: 1600,
    medical: 1250,
    lunch: 1150,
  });

  const addEmployee = () => {
    if (!newEmployee.name.trim()) {
      alert('Please enter employee name');
      return;
    }
    setPresets([
      ...presets,
      {
        name: newEmployee.name,
        gross: parseFloat(newEmployee.gross) || 0,
        fixed: {
          conveyance: parseFloat(newEmployee.conveyance) || 0,
          medical: parseFloat(newEmployee.medical) || 0,
          lunch: parseFloat(newEmployee.lunch) || 0,
        },
      },
    ]);
    setNewEmployee({
      name: '',
      gross: 40000,
      conveyance: 1600,
      medical: 1250,
      lunch: 1150,
    });
    setShowAddForm(false);
  };

  const removeEmployee = (name) => {
    if (window.confirm(`Remove ${name} from presets?`)) {
      setPresets(presets.filter((p) => p.name !== name));
    }
  };

  return (
    <Card className="shadow-sm border-purple-200 dark:border-purple-800">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <span>Manage Employees</span>
          </div>
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700"
          >
            <UserPlus className="h-4 w-4 mr-1" />
            Add Employee
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {showAddForm && (
          <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="col-span-2">
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
                <Label>Monthly Gross (₹)</Label>
                <Input
                  type="number"
                  value={newEmployee.gross}
                  onChange={(e) =>
                    setNewEmployee({
                      ...newEmployee,
                      gross: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Conveyance (₹)</Label>
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
                <Label>Medical (₹)</Label>
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
                <Label>Lunch (₹)</Label>
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
            <div className="flex gap-2">
              <Button onClick={addEmployee} className="flex-1 bg-green-600 hover:bg-green-700">
                Add
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
              No employees added yet. Click "Add Employee" to get started.
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
                    Gross: ₹{preset.gross.toLocaleString('en-IN')}
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
