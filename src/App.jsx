import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Navbar from "./Navbar";
import Messaging from "./Messaging";
import Home from "./Home";
import Targets from "./Targets";
import Leads from "./Leads";
import Accounts from "./Accounts";
import Campaigns from "./Campaigns";
import CRM from "./CRM";
import Analytics from "./Analytics";
import SmartAutomation from "./SmartAutomation";
import ReportingExport from "./ReportingExport";
import TeamCollaboration from "./TeamCollaboration";

function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-white text-black">
        <Navbar />
        <main className="flex-1 ml-20 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/messaging" element={<Messaging />} />
            <Route path="/send-dm" element={<Messaging />} />
            <Route path="/schedule-dm" element={<Messaging />} />
            <Route path="/targets" element={<Targets />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/crm" element={<CRM />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/automation" element={<SmartAutomation />} />
            <Route
              path="/safety"
              element={<Navigate to="/accounts" replace />}
            />
            <Route
              path="/targeting"
              element={<Navigate to="/leads" replace />}
            />
            <Route path="/reports" element={<ReportingExport />} />
            <Route path="/team" element={<TeamCollaboration />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
