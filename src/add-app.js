import { agentOfEmpiresDraft, applicationDraft } from './application-launcher.js';
import {
    TERMINAL_PROVIDER_GOTTY,
    TERMINAL_PROVIDER_TTYD,
    defaultBinaryForProvider,
    launcherDraft,
} from './terminal-launcher.js';

export const APP_TYPE_CUSTOM = 'custom';
export const APP_TYPE_GOTTY = 'gotty';
export const APP_TYPE_TTYD = 'ttyd';
export const APP_TYPE_AGENT_OF_EMPIRES = 'agent-of-empires';
export const APP_TYPE_MC = 'mc';
export const APP_TYPE_BTOP = 'btop';
export const APP_TYPE_FISH = 'fish';

export const ADD_APP_TYPES = [
    { value: APP_TYPE_CUSTOM, label: 'Custom' },
    { value: APP_TYPE_GOTTY, label: 'GoTTY' },
    { value: APP_TYPE_TTYD, label: 'ttyd' },
    { value: APP_TYPE_MC, label: 'MC terminal' },
    { value: APP_TYPE_BTOP, label: 'btop terminal' },
    { value: APP_TYPE_FISH, label: 'Fish terminal' },
    { value: APP_TYPE_AGENT_OF_EMPIRES, label: 'Agent of Empires' },
];

export function normalizeAddAppType(value) {
    const type = String(value || '').trim().toLowerCase();
    return ADD_APP_TYPES.some(item => item.value === type) ? type : APP_TYPE_CUSTOM;
}

export function addAppTypeLabel(value) {
    const type = normalizeAddAppType(value);
    return ADD_APP_TYPES.find(item => item.value === type)?.label || 'Custom';
}

export function isTerminalAddAppType(value) {
    const type = normalizeAddAppType(value);
    return [APP_TYPE_GOTTY, APP_TYPE_TTYD, APP_TYPE_MC, APP_TYPE_BTOP, APP_TYPE_FISH].includes(type);
}

function terminalPreset(type) {
    if (type === APP_TYPE_MC)
        return { name: 'MC', command: 'mc', icon: '📁' };
    if (type === APP_TYPE_BTOP)
        return { name: 'btop', command: 'btop', icon: '📊' };
    if (type === APP_TYPE_FISH)
        return { name: 'Fish', command: 'fish', icon: '🐟' };
    return null;
}

export function createAddAppDraft(value, port) {
    const type = normalizeAddAppType(value);

    if (type === APP_TYPE_AGENT_OF_EMPIRES) {
        const draft = agentOfEmpiresDraft(port);
        const args = ['serve', '--host', '0.0.0.0', '--daemon'];
        if (Number(port) !== 8080)
            args.push('--port', '{port}');
        return {
            ...draft,
            args: args.join('\n'),
            bindHost: '0.0.0.0',
        };
    }

    if (isTerminalAddAppType(type)) {
        const provider = type === APP_TYPE_TTYD ? TERMINAL_PROVIDER_TTYD : TERMINAL_PROVIDER_GOTTY;
        const preset = terminalPreset(type);
        return {
            ...launcherDraft(null, port),
            name: preset?.name || (type === APP_TYPE_TTYD ? 'ttyd Terminal' : 'GoTTY Terminal'),
            provider,
            binary: defaultBinaryForProvider(provider),
            command: preset?.command || 'bash',
            address: '{host}',
            group: 'Applications',
            icon: preset?.icon || '⌨️',
            accent: 'teal',
        };
    }

    return {
        ...applicationDraft(null, port),
        name: 'Custom app',
    };
}
