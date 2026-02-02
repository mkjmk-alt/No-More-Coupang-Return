import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header, BottomNav } from './components/Header';
import { ScanPage } from './pages/ScanPage';
import { GeneratePage } from './pages/GeneratePage';
import { TestPage } from './pages/TestPage';
import { ComparePage } from './pages/ComparePage';
import { LanguageProvider } from './utils/LanguageContext';
import './App.css';

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <div className="app">
          <Header />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<GeneratePage />} />
              <Route path="/scan" element={<ScanPage />} />
              <Route path="/test" element={<TestPage />} />
              <Route path="/compare" element={<ComparePage />} />
            </Routes>
          </main>
          <BottomNav />
        </div>
      </BrowserRouter>
    </LanguageProvider>
  );
}

export default App;
