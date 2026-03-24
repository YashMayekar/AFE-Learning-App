import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.tsx';
import './styles/neo-brutalism.css';

// Polyfill for URL.parse (missing in some Electron versions, required by react-pdf)
if (!URL.parse) {
    URL.parse = function (url: string, base?: string) {
        try {
            return new URL(url, base);
        } catch {
            return null;
        }
    } as any;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <HashRouter>
            <App />
        </HashRouter>
    </React.StrictMode>
);
