import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Header, BottomNav } from './components/Header';
import { ScanPage } from './pages/ScanPage';
import { GeneratePage } from './pages/GeneratePage';
import { TestPage } from './pages/TestPage';
import { ComparePage } from './pages/ComparePage';
// import { AiAssistantPage } from './pages/AiAssistantPage';
import { ExpirationPage } from './pages/ExpirationPage';
import { LanguageProvider } from './utils/LanguageContext';
import './App.css';

function AppContent() {
  const location = useLocation();
  const isScanPage = location.pathname === '/scan';

  return (
    <div className="app">
      {!isScanPage && <Header />}
      <main className={isScanPage ? "main-content-full" : "main-content"}>
        <Routes>
          <Route path="/" element={<GeneratePage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/test" element={<TestPage />} />
          <Route path="/compare" element={<ComparePage />} />
          {/* <Route path="/ai" element={<AiAssistantPage />} /> */}
          <Route path="/expiration" element={<ExpirationPage />} />
        </Routes>
      </main>
      {!isScanPage && <BottomNav />}
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </LanguageProvider>
  );
}

export default App;
