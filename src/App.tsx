import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header, BottomNav } from './components/Header';
import { ScanPage } from './pages/ScanPage';
import { GeneratePage } from './pages/GeneratePage';
import { TestPage } from './pages/TestPage';
import { ComparePage } from './pages/ComparePage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Header />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<ScanPage />} />
            <Route path="/generate" element={<GeneratePage />} />
            <Route path="/test" element={<TestPage />} />
            <Route path="/compare" element={<ComparePage />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}

export default App;
