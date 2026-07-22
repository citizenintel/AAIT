import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/reset.css';
import './styles/tokens.css';
import './styles/layout.css';
import './styles/pages.css';
import './styles/admin.css';
import './styles/widgets.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
