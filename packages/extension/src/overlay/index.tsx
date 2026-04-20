import React from 'react';
import ReactDOM from 'react-dom/client';
import { colors } from '../lib/tokens';

const Overlay = () => (
  <div style={{
    position: 'fixed',
    top: 0,
    right: 0,
    width: '300px',
    height: '100vh',
    backgroundColor: colors.black,
    color: colors.textPrimary,
    zIndex: 2147483647,
    borderLeft: `1px solid ${colors.glassBorder}`,
    padding: '20px',
    fontFamily: 'sans-serif'
  }}>
    <h1>BingeRoom Overlay</h1>
    <p>Syncing...</p>
  </div>
);

ReactDOM.createRoot(document.getElementById('root')!).render(<Overlay />);
