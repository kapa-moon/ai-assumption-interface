import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import AiAssumptionSixDimension from './pages/AiAssumptionSixDimension';
import AiAssumptionTwoDimension from './pages/AiAssumptionTwoDimension';
import AiAssumptionTwoDimensionChallenging from './pages/AiAssumptionTwoDimensionChallenging';
import AiAssumptionTwoDimensionSycophantic from './pages/AiAssumptionTwoDimensionSycophantic';
import NoAssumptionNeutral from './pages/NoAssumptionNeutral';
import NoAssumptionChallenging from './pages/NoAssumptionChallenging';
import NoAssumptionSycophantic from './pages/NoAssumptionSycophantic';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/ai-assumption-six-dimension" element={<AiAssumptionSixDimension />} />
        <Route path="/ai-assumption-two-dimension" element={<AiAssumptionTwoDimension />} />
        <Route path="/ai-assumption-two-dimension-challenging" element={<AiAssumptionTwoDimensionChallenging />} />
        <Route path="/ai-assumption-two-dimension-sycophantic" element={<AiAssumptionTwoDimensionSycophantic />} />
        <Route path="/no-assumption-neutral" element={<NoAssumptionNeutral />} />
        <Route path="/no-assumption-challenging" element={<NoAssumptionChallenging />} />
        <Route path="/no-assumption-sycophantic" element={<NoAssumptionSycophantic />} />
      </Routes>
    </BrowserRouter>
  );
}
