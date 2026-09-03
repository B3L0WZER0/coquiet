/** Prefix for everything served out of /public. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** An absolute /public path, moved under the base path. */
export function assetPath(path: string): string {
  return `${BASE_PATH}${path}`;
}
