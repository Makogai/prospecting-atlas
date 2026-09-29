/**
 * Named builds kept in the browser, shared by the museum planner and the
 * equipment loadout.
 *
 * Both store a build as its own share code rather than as structured state:
 * it's compact, and it means a saved build and a shared link can never drift
 * apart, because they're the same string.
 */
export interface SavedBuild {
  id: string;
  name: string;
  code: string;
  savedAt: string;
}

export const newBuildId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function readBuilds(key: string): SavedBuild[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    // Anything else in this key is somebody else's data or a corrupted write;
    // an empty library is a safer read than a crash on every page load.
    return Array.isArray(parsed) ? (parsed as SavedBuild[]) : [];
  } catch {
    return [];
  }
}

export function writeBuilds(key: string, builds: SavedBuild[]) {
  try {
    localStorage.setItem(key, JSON.stringify(builds));
  } catch {
    /* blocked storage — the build still works for this session */
  }
}

export function makeBuild(name: string, code: string): SavedBuild {
  return {
    id: newBuildId(),
    name: name.trim().slice(0, 40) || 'Untitled build',
    code,
    savedAt: new Date().toISOString(),
  };
}
