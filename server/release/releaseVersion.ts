export const UNKNOWN_RELEASE_VERSION = 'dev-unknown';

export function getReleaseVersion(environment: NodeJS.ProcessEnv = process.env): string {
  return environment.ROTE_RELEASE_VERSION?.trim() || UNKNOWN_RELEASE_VERSION;
}
