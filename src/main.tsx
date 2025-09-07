import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { PluginGate } from "../lib/obr-plugin/obr/PluginGate.tsx";
import { PluginThemeProvider } from "../lib/obr-plugin/obr/PluginThemeProvider.tsx";
import "../lib/obr-plugin/obr/index.css";

import { App } from './App.tsx'

const root = createRoot(document.getElementById('root')!);
root.render(
    <StrictMode>
        <PluginGate>
            <PluginThemeProvider>
                <App />
            </PluginThemeProvider>
        </PluginGate>
    </StrictMode>
);
