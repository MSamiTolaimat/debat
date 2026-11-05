import { HashRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Topics from "./pages/Topics";
import SessionPage from "./pages/Session";
import Evaluation from "./pages/Evaluation";
import About from "./pages/About";
import History from "./pages/History";
import Settings from "./pages/Settings";
import Team from "./pages/Team";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/topics" element={<Topics />} />
          <Route path="/session/:topicId" element={<SessionPage />} />
          <Route path="/team/:teamId" element={<Team />} />
          <Route path="/evaluate/:sessionId" element={<Evaluation />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
