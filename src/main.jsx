import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Patch: prevent base44 unhandled-errors-handlers crash when event.error?.stack is undefined
const _origOnError = window.onerror;
window.onerror = function(message, source, lineno, colno, error) {
  if (error && error.stack === undefined) {
    error.stack = '';
  }
  if (_origOnError) {
    return _origOnError.call(this, message, source, lineno, colno, error);
  }
  return false;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
