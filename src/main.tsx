import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Loja } from './estado/Loja';
import '@fontsource-variable/manrope';
import './estilos/global.css';

const raiz = document.getElementById('root');
if (!raiz) throw new Error('Elemento #root não encontrado.');

createRoot(raiz).render(
  <StrictMode>
    <Loja>
      <App />
    </Loja>
  </StrictMode>,
);
