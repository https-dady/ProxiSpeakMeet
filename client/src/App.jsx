import { ProxiProvider, useProxi } from './state/ProxiContext.jsx';
import { WorldCanvas } from './canvas/WorldCanvas.jsx';
import { MicGate } from './components/MicGate.jsx';
import { StatusBar } from './components/StatusBar.jsx';
import { PeerList } from './components/PeerList.jsx';
import { AuditPanel } from './components/AuditPanel.jsx';
import { SoundLegend } from './components/SoundLegend.jsx';
import { Notices } from './components/Notices.jsx';

function Office() {
  const { state } = useProxi();

  if (!state.selfId) {
    return (
      <div className="app app--gate">
        <StatusBar />
        <MicGate />
        <Notices />
      </div>
    );
  }

  return (
    <div className="app">
      <StatusBar />
      <main className="app__body">
        <WorldCanvas />
        <aside className="app__sidebar">
          <PeerList />
          <AuditPanel />
          <SoundLegend />
        </aside>
      </main>
      <Notices />
    </div>
  );
}

export function App() {
  return (
    <ProxiProvider>
      <Office />
    </ProxiProvider>
  );
}

export default App;