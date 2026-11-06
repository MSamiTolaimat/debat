import { HashRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import NewTraining from "./pages/NewTraining";
import SessionPage from "./pages/Session";
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
          <Route path="/new" element={<NewTraining />} />
          <Route path="/session/:topicId" element={<SessionPage />} />
          <Route path="/team/:teamId" element={<Team />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
