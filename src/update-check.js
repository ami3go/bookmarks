export const PACKAGE_NAME = 'cockpit-bookmarks';

function policyVersion(value) {
    if (!value || value === '(none)')
        return null;
    return value;
}

export function parseAptPolicy(output) {
    const text = String(output || '');
    const installed = text.match(/^\s*Installed:\s*(\S+)\s*$/m)?.[1] || null;
    const candidate = text.match(/^\s*Candidate:\s*(\S+)\s*$/m)?.[1] || null;

    return {
        installed: policyVersion(installed),
        candidate: policyVersion(candidate),
    };
}

export async function checkForPackageUpdate(cockpit) {
    if (!cockpit?.spawn)
        return null;

    const spawnOptions = {
        err: 'ignore',
        environ: ['LC_ALL=C'],
    };

    try {
        const output = await cockpit.spawn(
            ['apt-cache', 'policy', PACKAGE_NAME],
            spawnOptions
        );
        const { installed, candidate } = parseAptPolicy(output);

        if (!installed || !candidate || installed === candidate)
            return null;

        try {
            await cockpit.spawn(
                ['dpkg', '--compare-versions', candidate, 'gt', installed],
                spawnOptions
            );
        } catch (_) {
            return null;
        }

        return { installed, candidate };
    } catch (_) {
        // Update notification is optional. Non-Debian hosts and systems without
        // apt-cache/dpkg should keep running without displaying an error.
        return null;
    }
}
