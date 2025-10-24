import React, { useState } from 'react';
import '@/App.css';
import { ThemeProvider } from '@/contexts/ThemeContext';
import Sidebar from '@/components/Sidebar';
import Calculator1 from '@/components/calculators/Calculator1';
import Calculator2 from '@/components/calculators/Calculator2';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedCalculator, setSelectedCalculator] = useState('calculator1');

  return (
    <ThemeProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900">
        <Sidebar
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
          selectedCalculator={selectedCalculator}
          setSelectedCalculator={setSelectedCalculator}
        />
        
        <main className="flex-1 overflow-auto">
          {selectedCalculator === 'calculator1' && <Calculator1 />}
          {selectedCalculator === 'calculator2' && <Calculator2 />}
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
