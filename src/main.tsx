import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { PluginGate } from "./obr/PluginGate.tsx";
import { PluginThemeProvider } from "./obr/PluginThemeProvider.tsx";

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
