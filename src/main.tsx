import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './styles/index.css'
import { initWebVitals } from './lib/vitals'

// Initialize Core Web Vitals RUM monitoring
initWebVitals()

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root element not found in DOM')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
