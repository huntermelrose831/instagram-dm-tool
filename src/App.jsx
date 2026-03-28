import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AppStateProvider } from "./contexts/AppStateContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LoginScreen from "./LoginScreen";
import Navbar from "./Navbar";
import Messaging from "./Messaging";
import Home from "./Home";
import Targets from "./Targets";
import Leads from "./Leads";
import Accounts from "./Accounts";
import CRM from "./CRM";
import ReportingExport from "./ReportingExport";
import TeamCollaboration from "./TeamCollaboration";
import { FaBolt } from "react-icons/fa";

function VerifyingOverlay() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white text-black">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-black text-white mb-6">
        <FaBolt className="text-2xl" />
      </div>
      <div className="flex items-center gap-3">
        <svg
          className="animate-spin h-5 w-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="text-gray-500 text-sm">Verifying license…</span>
      </div>
    </div>
  );
}

function OfflineBanner() {
  return (
    <div className="bg-yellow-50 border-b border-yellow-200 text-yellow-800 text-xs text-center py-1.5 px-4">
      Offline mode — license will be re-verified when you reconnect.
    </div>
  );
}

function AuthenticatedApp() {
  const { offline } = useAuth();
  return (
    <AppStateProvider>
      <Router>
        {offline && <OfflineBanner />}
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
              <Route path="/crm" element={<CRM />} />
              <Route
                path="/safety"
                element={<Navigate to="/accounts" replace />}
              />
              <Route
                path="/targeting"
                element={<Navigate to="/leads" replace />}
              />
              {/* Redirect removed pages to home */}
              <Route path="/campaigns" element={<Navigate to="/" replace />} />
              <Route path="/analytics" element={<Navigate to="/" replace />} />
              <Route path="/automation" element={<Navigate to="/" replace />} />
              <Route path="/reports" element={<ReportingExport />} />
              <Route path="/team" element={<TeamCollaboration />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AppStateProvider>
  );
}

function AppGate() {
  const { authState } = useAuth();

  if (authState === "loading") return <VerifyingOverlay />;
  if (authState === "login" || authState === "locked") return <LoginScreen />;
  return <AuthenticatedApp />;
}

function App() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}

export default App;
