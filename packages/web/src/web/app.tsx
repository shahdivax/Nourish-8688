import React from 'react';
import { TabBar } from './components/TabBar';
import { ToastContainer } from './components/Toast';
import HomePage from './pages/home';
import LogPage from './pages/log';
import SettingsPage from './pages/settings';
import { useNourish } from './hooks/useNourish';

export default function App() {
  const nourish = useNourish();
  const { state, todayLog } = nourish;

  return (
    <div style={{
      maxWidth: 430,
      margin: '0 auto',
      minHeight: '100vh',
      background: 'var(--bg)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Use display:none on inactive tabs to preserve state without unmounting */}
      <div style={{ position: 'relative', minHeight: '100vh' }}>

        {/* HOME */}
        <div style={{ display: state.activeTab === 'home' ? 'block' : 'none' }}>
          <HomePage
            user={state.user}
            logs={state.logs}
            todayLog={todayLog}
            currentDate={state.currentDate}
            onRemoveFood={(id) => nourish.removeFood(state.currentDate, id)}
            onEditFood={(entry) => { nourish.setEditEntry(entry); nourish.setTab('log'); }}
            onLogTap={() => nourish.setTab('log')}
            onSettingsTap={() => nourish.setTab('settings')}
            onDeletedToast={() => nourish.showToast('Entry deleted')}
          />
        </div>

        {/* LOG */}
        <div style={{ display: state.activeTab === 'log' ? 'block' : 'none' }}>
          <LogPage
            currentDate={state.currentDate}
            editEntry={state.editEntry}
            onAdd={(entry) => { nourish.addFood(entry); nourish.showToast('Logged!'); }}
            onUpdate={(entry) => { nourish.updateFood(entry); nourish.setEditEntry(null); nourish.showToast('Saved'); }}
            onClearEdit={() => nourish.setEditEntry(null)}
            onToast={(msg, type) => nourish.showToast(msg, type)}
          />
        </div>

        {/* SETTINGS */}
        <div style={{ display: state.activeTab === 'settings' ? 'block' : 'none' }}>
          <SettingsPage
            user={state.user}
            currentDate={state.currentDate}
            onUpdateUser={(u) => { nourish.updateUser(u); nourish.showToast('Saved'); }}
            onExportCSV={() => { nourish.exportCSV(); nourish.showToast('Exported!'); }}
            onImportLogs={nourish.importLogs}
            onClearToday={() => { nourish.clearDay(state.currentDate); nourish.showToast('Today cleared'); }}
            onResetAll={nourish.resetAll}
            onToast={nourish.showToast}
            onLogWeight={(w) => nourish.logWeight(state.currentDate, w)}
          />
        </div>

      </div>

      <TabBar active={state.activeTab} onChange={nourish.setTab} />
      <ToastContainer toasts={state.toasts} onDismiss={nourish.dismissToast} />
    </div>
  );
}
