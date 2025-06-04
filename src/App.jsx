import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./Navbar";
import DMForm from "./DMForm";
import Home from "./Home";
import Targets from "./Targets";
import Leads from "./Leads";
import Accounts from "./Accounts";

function App() {
  return (
    <Router>
      <div className="flex">
        <Navbar />
        <main className="flex-1 flex items-center justify-center min-h-screen bg-gray-50">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/send-dm" element={<DMForm />} />
            <Route path="/targets" element={<Targets />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/accounts" element={<Accounts />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
