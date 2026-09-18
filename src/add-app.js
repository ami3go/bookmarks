import { agentOfEmpiresDraft, applicationDraft } from './application-launcher.js';
import { resolveExecutablePath } from './launcher-runtime.js';
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

export const ADD_APP_TYPES = [
    { value: APP_TYPE_CUSTOM, label: 'Custom' },
    { value: APP_TYPE_GOTTY, label: 'GoTTY' },
    { value: APP_TYPE_TTYD, label: 'ttyd' },
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
    return type === APP_TYPE_GOTTY || type === APP_TYPE_TTYD;
}

export async function resolveApplicationCommandPaths(cockpit, draft) {
    if (!draft)
        return draft;

    const originalCommand = String(draft.command || '').trim();
    if (!originalCommand)
        return draft;

    const command = await resolveExecutablePath(cockpit, originalCommand);
    let urlCommand = draft.urlCommand;
    if (urlCommand) {
        urlCommand = String(urlCommand).trim() === originalCommand
            ? command
            : await resolveExecutablePath(cockpit, urlCommand);
    }

    return { ...draft, command, urlCommand };
}

export function createAddAppDraft(value, port) {
    const type = normalizeAddAppType(value);

    if (type === APP_TYPE_AGENT_OF_EMPIRES)
        return agentOfEmpiresDraft(port);

    if (type === APP_TYPE_GOTTY || type === APP_TYPE_TTYD) {
        const provider = type === APP_TYPE_TTYD ? TERMINAL_PROVIDER_TTYD : TERMINAL_PROVIDER_GOTTY;
        return {
            ...launcherDraft(null, port),
            name: type === APP_TYPE_TTYD ? 'ttyd Terminal' : 'GoTTY Terminal',
            provider,
            binary: defaultBinaryForProvider(provider),
            command: 'bash',
            address: '{host}',
            group: 'Applications',
            icon: '⌨️',
            accent: 'teal',
        };
    }

    return {
        ...applicationDraft(null, port),
        name: 'Custom app',
    };
}
