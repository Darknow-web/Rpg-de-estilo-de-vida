import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App';
import { registerModule } from '@/core/module';
import { habitsModule } from '@/modules/habits';
import { gymModule } from '@/modules/gym';
import { calendarModule } from '@/modules/calendar';

registerModule(habitsModule);
registerModule(gymModule);
registerModule(calendarModule);

if (localStorage.getItem('lq-motion') === 'low') document.documentElement.setAttribute('data-motion', 'low');

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
