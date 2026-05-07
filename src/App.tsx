import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import AiAssumptionSixDimension from './pages/AiAssumptionSixDimension';
import AiAssumptionTwoDimension from './pages/AiAssumptionTwoDimension';
import NoAssumptionNeutral from './pages/NoAssumptionNeutral';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/ai-assumption-six-dimension" element={<AiAssumptionSixDimension />} />
        <Route path="/ai-assumption-two-dimension" element={<AiAssumptionTwoDimension />} />
        <Route path="/no-assumption-neutral" element={<NoAssumptionNeutral />} />
      </Routes>
    </BrowserRouter>
  );
}
