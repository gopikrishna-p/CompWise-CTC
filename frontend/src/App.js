import React from 'react';
import '@/App.css';
import { ThemeProvider } from '@/contexts/ThemeContext';
import EnhancedPayrollCalculator from '@/components/calculators/EnhancedPayrollCalculator';

function App() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <EnhancedPayrollCalculator />
      </div>
    </ThemeProvider>
  );
}

export default App;
