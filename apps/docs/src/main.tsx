import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@jfrader/tokens/tokens.css';
import '@jfrader/tokens/base.css';
import './styles.css';
import { App } from './app';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element.');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
