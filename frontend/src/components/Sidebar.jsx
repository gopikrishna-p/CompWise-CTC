import React from 'react';
import { Calculator, Menu, X, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';

const Sidebar = ({ isOpen, setIsOpen, selectedCalculator, setSelectedCalculator }) => {
  const { theme, toggleTheme } = useTheme();

  const calculators = [
    { id: 'calculator1', name: 'Payroll Calculator', subtitle: 'ERPNext Export' },
    { id: 'calculator2', name: 'Advanced Calculator', subtitle: 'PDF Export & Tests' },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        data-testid="sidebar"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500 rounded-lg">
                  <Calculator className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900 dark:text-white">CompWise-CTC</h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Payroll System</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setIsOpen(false)}
                data-testid="close-sidebar-btn"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase px-3 mb-2">
              Calculators
            </p>
            {calculators.map((calc) => (
              <button
                key={calc.id}
                onClick={() => {
                  setSelectedCalculator(calc.id);
                  setIsOpen(false); // Close on mobile after selection
                }}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                  selectedCalculator === calc.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                data-testid={`nav-${calc.id}`}
              >
                <div className="flex items-center gap-3">
                  <Calculator className="h-5 w-5" />
                  <div>
                    <div className="text-sm">{calc.name}</div>
                    <div className="text-xs opacity-70">{calc.subtitle}</div>
                  </div>
                </div>
              </button>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-700">
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={toggleTheme}
              data-testid="theme-toggle-btn"
            >
              {theme === 'light' ? (
                <>
                  <Moon className="h-4 w-4" />
                  <span>Dark Mode</span>
                </>
              ) : (
                <>
                  <Sun className="h-4 w-4" />
                  <span>Light Mode</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Menu Button */}
      <Button
        variant="outline"
        size="icon"
        className="fixed top-4 left-4 z-30 lg:hidden"
        onClick={() => setIsOpen(true)}
        data-testid="open-sidebar-btn"
      >
        <Menu className="h-5 w-5" />
      </Button>
    </>
  );
};

export default Sidebar;
