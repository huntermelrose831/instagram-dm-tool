# State Persistence Guide for TurboDM

This guide explains how state persistence works in the TurboDM application to maintain page state when navigating between pages.

## 🎯 Current Implementation

### 1. **Global State Context (Primary Solution)**

We've implemented a React Context-based solution that persists state across page navigation:

#### Features:

- ✅ **Automatic localStorage persistence** - State is saved automatically
- ✅ **Page-specific state slices** - Each page has its own state section
- ✅ **Selective persistence** - Only important data is saved, not temporary UI state
- ✅ **Type-safe state management** - Custom hooks for each page

#### Files:

- `src/contexts/AppStateContext.jsx` - Main context implementation
- Each component uses `usePageState()` hooks for state management

### 2. **How It Works**

```jsx
// In any component:
import { useMessagingState } from "./contexts/AppStateContext";

function Messaging() {
  const { messagingState, setMessagingState } = useMessagingState();

  // State persists automatically when you navigate away and return
  const { selectedAccount, targets, messages } = messagingState;

  // Update state (automatically saves to localStorage)
  const updateState = (updates) => {
    setMessagingState({ ...messagingState, ...updates });
  };
}
```

### 3. **What Gets Persisted**

#### ✅ **Messaging Page:**

- Selected account
- Target users list
- Message variations
- Active tab (Send/Schedule)

#### ✅ **Reports Page:**

- Active tab
- Report builder configuration
- Form inputs

#### ✅ **Other Pages:**

- Search queries
- Filter selections
- Sort preferences
- Active tabs

#### ❌ **What Doesn't Persist:**

- Loading states
- Error messages
- Modal open/close states
- API data (fetched fresh)

## 🚀 Benefits

1. **Better UX** - Users don't lose their work when switching pages
2. **Productivity** - No need to re-enter form data
3. **Professional Feel** - State persistence feels native and polished
4. **Performance** - Reduces unnecessary re-fetching

## 🔧 Alternative Methods (Available)

### **Method 1: React Router State**

```jsx
// Pass state through navigation
navigate("/reports", { state: { preservedData: formData } });

// Access in target component
const location = useLocation();
const preservedData = location.state?.preservedData;
```

### **Method 2: URL Parameters**

```jsx
// Store simple state in URL
const searchParams = new URLSearchParams();
searchParams.set("tab", "reports");
navigate(`/reports?${searchParams}`);
```

### **Method 3: Session Storage**

```jsx
// Manual session storage
sessionStorage.setItem("messagingState", JSON.stringify(state));
const restored = JSON.parse(sessionStorage.getItem("messagingState"));
```

## 📱 Current Status

- ✅ **App-wide context provider** implemented
- ✅ **ReportingExport component** updated to use context
- ✅ **Messaging component** partially updated
- 🔄 **Other components** can be updated as needed

## 🎯 Usage Examples

### Basic State Update:

```jsx
const { reportsState, setReportsState } = useReportsState();
setReportsState({ ...reportsState, activeTab: "builder" });
```

### Form Data Persistence:

```jsx
const { messagingState, setMessagingState } = useMessagingState();
const updateTargets = (newTargets) => {
  setMessagingState({ ...messagingState, targets: newTargets });
};
```

### Tab State Persistence:

```jsx
const { activeTab } = reportsState;
// Tab state is automatically restored when returning to page
```

## 🔄 How to Test

1. **Fill out a form** on the Messaging page
2. **Navigate to Reports** page
3. **Navigate back to Messaging**
4. **Verify your form data is still there** ✅

## 🛠️ Implementation Notes

- State is saved to `localStorage` with key `turbodm-app-state`
- Each page has its own state slice to avoid conflicts
- Temporary UI state (loading, errors) is kept local
- State is automatically loaded on app startup
- Fallback to default state if localStorage is unavailable

This implementation provides a professional, seamless user experience while maintaining good performance and code organization.
