import {
    TERMINAL_PROVIDER_GOTTY,
    TERMINAL_PROVIDER_TTYD,
    normalizeTerminalProvider,
    terminalProviderLabel,
} from './terminal-launcher.js';

export const MINIMUM_TERMINAL_PROVIDER_VERSIONS = Object.freeze({
    [TERMINAL_PROVIDER_GOTTY]: '1.2.0',
    [TERMINAL_PROVIDER_TTYD]: '1.7.4',
});

const REQUIRED_PROVIDER_OPTIONS = Object.freeze({
    [TERMINAL_PROVIDER_GOTTY]: ['--address', '--port', '--permit-write', '--path'],
    [TERMINAL_PROVIDER_TTYD]: ['--interface', '--port', '--writable', '--base-path'],
});

function cleanText(value) {
    return String(value || '').replace(/[\0\r]+/g, '').trim();
}

export function parseTerminalProviderVersion(value) {
    const text = cleanText(value);
    const match = text.match(/(?:^|[^0-9])v?(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?/);
    if (!match)
        return null;
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
        text: `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`,
    };
}

export function compareTerminalProviderVersions(left, right) {
    const parsedLeft = typeof left === 'string' ? parseTerminalProviderVersion(left) : left;
    const parsedRight = typeof right === 'string' ? parseTerminalProviderVersion(right) : right;
    if (!parsedLeft || !parsedRight)
        return null;
    for (const key of ['major', 'minor', 'patch']) {
        if (parsedLeft[key] < parsedRight[key])
            return -1;
        if (parsedLeft[key] > parsedRight[key])
            return 1;
    }
    return 0;
}

export function minimumTerminalProviderVersion(provider) {
    return MINIMUM_TERMINAL_PROVIDER_VERSIONS[normalizeTerminalProvider(provider)];
}

export function requiredTerminalProviderOptions(provider) {
    return [...REQUIRED_PROVIDER_OPTIONS[normalizeTerminalProvider(provider)]];
}

export function evaluateTerminalProviderCompatibility(provider, versionOutput, helpOutput) {
    const normalizedProvider = normalizeTerminalProvider(provider);
    const minimumVersion = minimumTerminalProviderVersion(normalizedProvider);
    const version = parseTerminalProviderVersion(versionOutput);
    const requiredOptions = requiredTerminalProviderOptions(normalizedProvider);
    const help = String(helpOutput || '');
    const missingOptions = requiredOptions.filter(option => !help.includes(option));
    const versionComparison = version ? compareTerminalProviderVersions(version, minimumVersion) : null;

    let supported = true;
    let reason = '';
    if (versionComparison !== null && versionComparison < 0) {
        supported = false;
        reason = 'version-too-old';
    } else if (missingOptions.length) {
        supported = false;
        reason = 'missing-options';
    }

    return {
        provider: normalizedProvider,
        label: terminalProviderLabel(normalizedProvider),
        available: true,
        supported,
        reason,
        version: version?.text || null,
        rawVersion: cleanText(versionOutput),
        minimumVersion,
        requiredOptions,
        missingOptions,
        versionVerified: version !== null,
    };
}

function errorText(cockpit, error) {
    try {
        return cockpit?.message ? cockpit.message(error) : String(error?.message || error || 'Unknown error');
    } catch (_) {
        return String(error?.message || error || 'Unknown error');
    }
}

export async function checkTerminalProviderCompatibility(cockpit, provider, binary) {
    const normalizedProvider = normalizeTerminalProvider(provider);
    const label = terminalProviderLabel(normalizedProvider);
    const executable = cleanText(binary);
    const minimumVersion = minimumTerminalProviderVersion(normalizedProvider);

    if (!cockpit?.spawn) {
        return {
            provider: normalizedProvider,
            label,
            binary: executable,
            available: false,
            supported: false,
            reason: 'cockpit-unavailable',
            version: null,
            rawVersion: '',
            minimumVersion,
            requiredOptions: requiredTerminalProviderOptions(normalizedProvider),
            missingOptions: [],
            versionVerified: false,
            error: 'Cockpit command execution is unavailable.',
        };
    }

    if (!executable) {
        return {
            provider: normalizedProvider,
            label,
            binary: executable,
            available: false,
            supported: false,
            reason: 'missing-binary',
            version: null,
            rawVersion: '',
            minimumVersion,
            requiredOptions: requiredTerminalProviderOptions(normalizedProvider),
            missingOptions: [],
            versionVerified: false,
            error: `${label} executable is not configured.`,
        };
    }

    let versionOutput = '';
    let helpOutput = '';
    let versionError = null;
    let helpError = null;

    try {
        versionOutput = await cockpit.spawn([executable, '--version'], { err: 'out' });
    } catch (error) {
        versionError = error;
    }

    try {
        helpOutput = await cockpit.spawn([executable, '--help'], { err: 'out' });
    } catch (error) {
        helpError = error;
    }

    if (versionError && helpError) {
        return {
            provider: normalizedProvider,
            label,
            binary: executable,
            available: false,
            supported: false,
            reason: 'not-runnable',
            version: null,
            rawVersion: '',
            minimumVersion,
            requiredOptions: requiredTerminalProviderOptions(normalizedProvider),
            missingOptions: [],
            versionVerified: false,
            error: errorText(cockpit, versionError),
        };
    }

    const result = evaluateTerminalProviderCompatibility(normalizedProvider, versionOutput, helpOutput);
    return {
        ...result,
        binary: executable,
        available: true,
        versionProbeFailed: Boolean(versionError),
        helpProbeFailed: Boolean(helpError),
        error: helpError ? errorText(cockpit, helpError) : '',
    };
}

export function terminalProviderCompatibilityMessage(result) {
    if (!result)
        return '';

    const label = result.label || terminalProviderLabel(result.provider);
    const binary = result.binary ? ` (${result.binary})` : '';

    if (!result.available) {
        return `${label}${binary} is not available or could not be executed. Install a supported ${label} build and check the executable path.`;
    }

    if (result.reason === 'version-too-old') {
        return `${label} ${result.version} is unsupported. Cockpit Bookmarks requires ${label} ${result.minimumVersion} or newer. Older releases and forks do not provide the launcher CLI contract used here.`;
    }

    if (result.reason === 'missing-options') {
        return `${label}${result.version ? ` ${result.version}` : ''} is not a compatible build. Missing required option${result.missingOptions.length === 1 ? '' : 's'}: ${result.missingOptions.join(', ')}. This commonly indicates an old or incompatible fork.`;
    }

    if (!result.versionVerified) {
        return `${label}${binary} provides the required launcher options, but its version string could not be identified. Compatibility is based on the detected CLI capabilities.`;
    }

    return `${label} ${result.version} is compatible (minimum supported ${result.minimumVersion}).`;
}

export async function assertTerminalProviderCompatibility(cockpit, provider, binary) {
    const result = await checkTerminalProviderCompatibility(cockpit, provider, binary);
    if (!result.supported)
        throw new Error(terminalProviderCompatibilityMessage(result));
    return result;
}
