export const PACKAGE_NAME = 'cockpit-bookmarks';

function policyVersion(value) {
    if (!value || value === '(none)')
        return null;
    return value;
}

export function aptPolicyHasRepository(output) {
    return String(output || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .some(line => /^\d+\s+\S+/.test(line) && !line.includes('/var/lib/dpkg/status'));
}

export function parseAptPolicy(output) {
    const text = String(output || '');
    const installed = text.match(/^\s*Installed:\s*(\S+)\s*$/m)?.[1] || null;
    const candidate = text.match(/^\s*Candidate:\s*(\S+)\s*$/m)?.[1] || null;

    return {
        installed: policyVersion(installed),
        candidate: policyVersion(candidate),
        repositoryAvailable: aptPolicyHasRepository(text),
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
        const { installed, candidate, repositoryAvailable } = parseAptPolicy(output);

        // A standalone `apt install ./package.deb` is represented only by the
        // dpkg status database. There is no repository candidate to monitor, so
        // do not run a meaningless version comparison or imply update coverage.
        if (!repositoryAvailable || !installed || !candidate || installed === candidate)
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
