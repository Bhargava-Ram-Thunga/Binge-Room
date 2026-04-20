import React from 'react';
import ReactDOM from 'react-dom/client';
import { colors } from '../lib/tokens';

const Popup = () => (
  <div style={{
    width: '300px',
    height: '400px',
    backgroundColor: colors.black,
    color: colors.textPrimary,
    padding: '20px',
    fontFamily: 'sans-serif'
  }}>
    <h1>BingeRoom</h1>
    <p>Welcome to the party!</p>
  </div>
);

ReactDOM.createRoot(document.getElementById('root')!).render(<Popup />);
