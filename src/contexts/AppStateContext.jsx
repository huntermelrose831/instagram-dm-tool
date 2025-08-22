import React, { createContext, useContext, useReducer, useEffect } from "react";

// Define action types
const actionTypes = {
  SET_MESSAGING_STATE: "SET_MESSAGING_STATE",
  SET_REPORTS_STATE: "SET_REPORTS_STATE",
  SET_TARGETS_STATE: "SET_TARGETS_STATE",
  SET_LEADS_STATE: "SET_LEADS_STATE",
  SET_ACCOUNTS_STATE: "SET_ACCOUNTS_STATE",
  SET_CRM_STATE: "SET_CRM_STATE",
  SET_TEAM_STATE: "SET_TEAM_STATE",
  RESET_STATE: "RESET_STATE",
  LOAD_STATE_FROM_STORAGE: "LOAD_STATE_FROM_STORAGE",
};

// Initial state
const initialState = {
  messaging: {
    selectedAccount: "",
    targets: "",
    messages: [""],
    isScheduled: false,
    scheduleTime: "",
    isRecurring: false,
    recurringInterval: "daily",
    activeTab: "send",
  },
  reports: {
    activeTab: "reports",
    reports: [],
    scheduledReports: [],
    exportJobs: [],
    showReportBuilder: false,
    reportConfig: {
      name: "",
      type: "standard",
      dateRange: "last_30_days",
      metrics: [],
      filters: {},
      visualization: "table",
      format: "csv",
      schedule: { frequency: "manual", time: "09:00", days: [] },
    },
  },
  targets: {
    targets: [],
    selectedTargets: [],
    searchQuery: "",
    filterStatus: "all",
  },
  leads: {
    leads: [],
    selectedLeads: [],
    searchQuery: "",
    filterStatus: "all",
    sortBy: "created_at",
    sortOrder: "desc",
  },
  accounts: {
    accounts: [],
    selectedAccount: null,
    showAddModal: false,
    showEditModal: false,
  },
  crm: {
    contacts: [],
    selectedContact: null,
    searchQuery: "",
    filterStatus: "all",
    showAddModal: false,
  },
  team: {
    activeTab: "members",
    members: [],
    roles: [],
    templates: [],
    workspaces: [],
    activity: [],
  },
};

// Reducer function
function appStateReducer(state, action) {
  switch (action.type) {
    case actionTypes.SET_MESSAGING_STATE:
      return {
        ...state,
        messaging: { ...state.messaging, ...action.payload },
      };
    case actionTypes.SET_REPORTS_STATE:
      return {
        ...state,
        reports: { ...state.reports, ...action.payload },
      };
    case actionTypes.SET_TARGETS_STATE:
      return {
        ...state,
        targets: { ...state.targets, ...action.payload },
      };
    case actionTypes.SET_LEADS_STATE:
      return {
        ...state,
        leads: { ...state.leads, ...action.payload },
      };
    case actionTypes.SET_ACCOUNTS_STATE:
      return {
        ...state,
        accounts: { ...state.accounts, ...action.payload },
      };
    case actionTypes.SET_CRM_STATE:
      return {
        ...state,
        crm: { ...state.crm, ...action.payload },
      };
    case actionTypes.SET_TEAM_STATE:
      return {
        ...state,
        team: { ...state.team, ...action.payload },
      };
    case actionTypes.LOAD_STATE_FROM_STORAGE:
      return { ...state, ...action.payload };
    case actionTypes.RESET_STATE:
      return initialState;
    default:
      return state;
  }
}

// Create context
const AppStateContext = createContext();

// Context provider component
export function AppStateProvider({ children }) {
  const [state, dispatch] = useReducer(appStateReducer, initialState);

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const savedState = localStorage.getItem("turbodm-app-state");
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        dispatch({
          type: actionTypes.LOAD_STATE_FROM_STORAGE,
          payload: parsedState,
        });
      }
    } catch (error) {
      console.warn("Failed to load state from localStorage:", error);
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    try {
      // Only save certain parts of state, exclude temporary UI state
      const stateToSave = {
        messaging: {
          selectedAccount: state.messaging.selectedAccount,
          targets: state.messaging.targets,
          messages: state.messaging.messages,
          activeTab: state.messaging.activeTab,
        },
        reports: {
          activeTab: state.reports.activeTab,
          reportConfig: state.reports.reportConfig,
        },
        targets: {
          searchQuery: state.targets.searchQuery,
          filterStatus: state.targets.filterStatus,
        },
        leads: {
          searchQuery: state.leads.searchQuery,
          filterStatus: state.leads.filterStatus,
          sortBy: state.leads.sortBy,
          sortOrder: state.leads.sortOrder,
        },
        crm: {
          searchQuery: state.crm.searchQuery,
          filterStatus: state.crm.filterStatus,
        },
        team: {
          activeTab: state.team.activeTab,
        },
      };

      localStorage.setItem("turbodm-app-state", JSON.stringify(stateToSave));
    } catch (error) {
      console.warn("Failed to save state to localStorage:", error);
    }
  }, [state]);

  // Action creators
  const actions = {
    setMessagingState: (payload) =>
      dispatch({ type: actionTypes.SET_MESSAGING_STATE, payload }),
    setReportsState: (payload) =>
      dispatch({ type: actionTypes.SET_REPORTS_STATE, payload }),
    setTargetsState: (payload) =>
      dispatch({ type: actionTypes.SET_TARGETS_STATE, payload }),
    setLeadsState: (payload) =>
      dispatch({ type: actionTypes.SET_LEADS_STATE, payload }),
    setAccountsState: (payload) =>
      dispatch({ type: actionTypes.SET_ACCOUNTS_STATE, payload }),
    setCrmState: (payload) =>
      dispatch({ type: actionTypes.SET_CRM_STATE, payload }),
    setTeamState: (payload) =>
      dispatch({ type: actionTypes.SET_TEAM_STATE, payload }),
    resetState: () => dispatch({ type: actionTypes.RESET_STATE }),
  };

  return (
    <AppStateContext.Provider value={{ state, actions }}>
      {children}
    </AppStateContext.Provider>
  );
}

// Custom hook to use the context
export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return context;
}

// Custom hooks for specific state slices
export function useMessagingState() {
  const { state, actions } = useAppState();
  return {
    messagingState: state.messaging,
    setMessagingState: actions.setMessagingState,
  };
}

export function useReportsState() {
  const { state, actions } = useAppState();
  return {
    reportsState: state.reports,
    setReportsState: actions.setReportsState,
  };
}

export function useTargetsState() {
  const { state, actions } = useAppState();
  return {
    targetsState: state.targets,
    setTargetsState: actions.setTargetsState,
  };
}

export function useLeadsState() {
  const { state, actions } = useAppState();
  return {
    leadsState: state.leads,
    setLeadsState: actions.setLeadsState,
  };
}

export function useAccountsState() {
  const { state, actions } = useAppState();
  return {
    accountsState: state.accounts,
    setAccountsState: actions.setAccountsState,
  };
}

export function useCrmState() {
  const { state, actions } = useAppState();
  return {
    crmState: state.crm,
    setCrmState: actions.setCrmState,
  };
}

export function useTeamState() {
  const { state, actions } = useAppState();
  return {
    teamState: state.team,
    setTeamState: actions.setTeamState,
  };
}
