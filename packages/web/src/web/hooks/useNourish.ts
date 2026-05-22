import { useReducer, useEffect, useCallback, useRef } from 'react';
import {
  isOnboarded, setOnboarded,
  getUser, saveUser,
  getLogs, saveLogs, getDayLog, saveDayLog, clearAll,
  getHabitsData, saveHabitsData,
  type NourishUser, type FoodEntry, type DayLog, type NourishLogs, type HabitsData,
} from '../lib/storage';
import { todayKey } from '../lib/calculations';

// ─── State ───────────────────────────────────────────────────────────────────

export interface AppState {
  onboarded: boolean;
  user: NourishUser | null;
  logs: NourishLogs;
  habitsData: HabitsData;
  // transient
  toasts: Toast[];
  editEntry: FoodEntry | null; // set when tapping a food item to edit
  activeTab: TabId;
  currentDate: string;
}

export type TabId = 'home' | 'log' | 'insights' | 'habits' | 'settings';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

// ─── Actions ─────────────────────────────────────────────────────────────────

type Action =
  | { type: 'COMPLETE_ONBOARDING'; user: NourishUser }
  | { type: 'UPDATE_USER'; user: NourishUser }
  | { type: 'ADD_FOOD'; entry: FoodEntry }
  | { type: 'UPDATE_FOOD'; entry: FoodEntry }
  | { type: 'REMOVE_FOOD'; date: string; id: string }
  | { type: 'SET_WATER'; date: string; glasses: number }
  | { type: 'LOG_WEIGHT'; date: string; weight: number }
  | { type: 'CLEAR_DAY'; date: string }
  | { type: 'IMPORT_LOGS'; incoming: NourishLogs }
  | { type: 'RESET_ALL' }
  | { type: 'SHOW_TOAST'; toast: Toast }
  | { type: 'DISMISS_TOAST'; id: string }
  | { type: 'SET_EDIT_ENTRY'; entry: FoodEntry | null }
  | { type: 'SET_TAB'; tab: TabId }
  | { type: 'SET_DATE'; date: string }
  | { type: 'SAVE_HABITS'; data: HabitsData };

// ─── Reducer ─────────────────────────────────────────────────────────────────

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'COMPLETE_ONBOARDING':
      return { ...state, onboarded: true, user: action.user };

    case 'UPDATE_USER':
      return { ...state, user: action.user };

    case 'ADD_FOOD': {
      const date = action.entry.date;
      const existing = state.logs[date] ?? { water: 0, foods: [] };
      const updated: DayLog = { ...existing, foods: [...existing.foods, action.entry] };
      return { ...state, logs: { ...state.logs, [date]: updated } };
    }

    case 'UPDATE_FOOD': {
      const date = action.entry.date;
      const existing = state.logs[date] ?? { water: 0, foods: [] };
      const updated: DayLog = {
        ...existing,
        foods: existing.foods.map(f => f.id === action.entry.id ? action.entry : f),
      };
      return { ...state, logs: { ...state.logs, [date]: updated } };
    }

    case 'REMOVE_FOOD': {
      const existing = state.logs[action.date] ?? { water: 0, foods: [] };
      const updated: DayLog = { ...existing, foods: existing.foods.filter(f => f.id !== action.id) };
      return { ...state, logs: { ...state.logs, [action.date]: updated } };
    }

    case 'SET_WATER': {
      const existing = state.logs[action.date] ?? { water: 0, foods: [] };
      return { ...state, logs: { ...state.logs, [action.date]: { ...existing, water: action.glasses } } };
    }

    case 'LOG_WEIGHT': {
      const existing = state.logs[action.date] ?? { water: 0, foods: [] };
      return { ...state, logs: { ...state.logs, [action.date]: { ...existing, weight: action.weight } } };
    }

    case 'CLEAR_DAY': {
      const newLogs = { ...state.logs };
      delete newLogs[action.date];
      return { ...state, logs: newLogs };
    }

    case 'IMPORT_LOGS': {
      // Merge: new entries by id, no duplicates
      const merged: NourishLogs = { ...state.logs };
      for (const [date, log] of Object.entries(action.incoming)) {
        const existing = merged[date] ?? { water: 0, foods: [] };
        const existingIds = new Set(existing.foods.map(f => f.id));
        const newFoods = log.foods.filter(f => !existingIds.has(f.id));
        merged[date] = {
          ...existing,
          water: log.water || existing.water,
          foods: [...existing.foods, ...newFoods],
          weight: log.weight ?? existing.weight,
        };
      }
      return { ...state, logs: merged };
    }

    case 'RESET_ALL':
      return {
        onboarded: false,
        user: null,
        logs: {},
        habitsData: { habits: [], failedDates: {} },
        toasts: [],
        editEntry: null,
        activeTab: 'home',
        currentDate: todayKey(),
      };

    case 'SHOW_TOAST':
      return { ...state, toasts: [...state.toasts, action.toast] };

    case 'DISMISS_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.id) };

    case 'SET_EDIT_ENTRY':
      return { ...state, editEntry: action.entry };

    case 'SET_TAB':
      return { ...state, activeTab: action.tab };

    case 'SET_DATE':
      return { ...state, currentDate: action.date };

    case 'SAVE_HABITS':
      return { ...state, habitsData: action.data };

    default:
      return state;
  }
}

// ─── Initial state ────────────────────────────────────────────────────────────

function init(): AppState {
  return {
    onboarded: isOnboarded(),
    user: getUser(),
    logs: getLogs(),
    habitsData: getHabitsData(),
    toasts: [],
    editEntry: null,
    activeTab: 'home',
    currentDate: todayKey(),
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNourish() {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  // Sync to localStorage on relevant changes
  useEffect(() => {
    if (state.onboarded) setOnboarded();
  }, [state.onboarded]);

  useEffect(() => {
    if (state.user) saveUser(state.user);
  }, [state.user]);

  useEffect(() => {
    saveLogs(state.logs);
  }, [state.logs]);

  useEffect(() => {
    saveHabitsData(state.habitsData);
  }, [state.habitsData]);

  // Date auto-reset on window focus
  useEffect(() => {
    const check = () => {
      const today = todayKey();
      if (today !== state.currentDate) {
        dispatch({ type: 'SET_DATE', date: today });
      }
    };
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, [state.currentDate]);

  // Toast auto-dismiss
  const toastTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = crypto.randomUUID();
    dispatch({ type: 'SHOW_TOAST', toast: { id, message, type } });
    toastTimers.current[id] = setTimeout(() => {
      dispatch({ type: 'DISMISS_TOAST', id });
      delete toastTimers.current[id];
    }, 2200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    clearTimeout(toastTimers.current[id]);
    delete toastTimers.current[id];
    dispatch({ type: 'DISMISS_TOAST', id });
  }, []);

  // Actions
  const completeOnboarding = useCallback((user: NourishUser) => {
    dispatch({ type: 'COMPLETE_ONBOARDING', user });
  }, []);

  const updateUser = useCallback((user: NourishUser) => {
    dispatch({ type: 'UPDATE_USER', user });
  }, []);

  const addFood = useCallback((entry: FoodEntry) => {
    dispatch({ type: 'ADD_FOOD', entry });
  }, []);

  const updateFood = useCallback((entry: FoodEntry) => {
    dispatch({ type: 'UPDATE_FOOD', entry });
  }, []);

  const removeFood = useCallback((date: string, id: string) => {
    dispatch({ type: 'REMOVE_FOOD', date, id });
  }, []);

  const setWater = useCallback((date: string, glasses: number) => {
    dispatch({ type: 'SET_WATER', date, glasses });
  }, []);

  const logWeight = useCallback((date: string, weight: number) => {
    dispatch({ type: 'LOG_WEIGHT', date, weight });
  }, []);

  const clearDay = useCallback((date: string) => {
    dispatch({ type: 'CLEAR_DAY', date });
  }, []);

  const importLogs = useCallback((incoming: NourishLogs) => {
    dispatch({ type: 'IMPORT_LOGS', incoming });
  }, []);

  const resetAll = useCallback(() => {
    clearAll();
    dispatch({ type: 'RESET_ALL' });
  }, []);

  const setEditEntry = useCallback((entry: FoodEntry | null) => {
    dispatch({ type: 'SET_EDIT_ENTRY', entry });
  }, []);

  const setTab = useCallback((tab: TabId) => {
    dispatch({ type: 'SET_TAB', tab });
  }, []);

  const saveHabits = useCallback((data: HabitsData) => {
    dispatch({ type: 'SAVE_HABITS', data });
  }, []);

  // Derived helpers
  const todayLog = state.logs[state.currentDate] ?? { water: 0, foods: [] };

  const exportCSV = useCallback(() => {
    const rows = ['Date,MealType,FoodName,Qty,Unit,Calories,Protein(g),Carbs(g),Fat(g)'];
    const logs = getLogs();
    Object.entries(logs).sort().forEach(([date, log]) => {
      log.foods.forEach(f => {
        const row = [
          date, f.mealType,
          `"${f.name.replace(/"/g, '""')}"`,
          f.quantity, f.unit, f.calories,
          Math.round(f.protein * 10) / 10,
          Math.round(f.carbs * 10) / 10,
          Math.round(f.fat * 10) / 10,
        ].join(',');
        rows.push(row);
      });
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nourish-export-${todayKey()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return {
    state,
    todayLog,
    dispatch,
    // actions
    completeOnboarding,
    updateUser,
    addFood,
    updateFood,
    removeFood,
    setWater,
    logWeight,
    clearDay,
    importLogs,
    resetAll,
    setEditEntry,
    setTab,
    saveHabits,
    exportCSV,
    showToast,
    dismissToast,
  };
}
