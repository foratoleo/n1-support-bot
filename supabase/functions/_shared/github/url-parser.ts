/**
 * GitHub URL Parser Utilities
 *
 * Provides functions to parse and validate GitHub repository URLs
 * in various formats (HTTPS, SSH, Git protocol).
 *
 * @module github/url-parser
 */

/**
 * Result of parsing a GitHub URL
 */
export interface ParsedGitHubUrl {
  /** Repository owner (user or organization) */
  owner: string;
  /** Repository name (without .git extension) */
  repo: string;
}

/**
 * Supported GitHub URL formats:
 * - HTTPS: https://github.com/owner/repo
 * - HTTPS with .git: https://github.com/owner/repo.git
 * - SSH: git@github.com:owner/repo.git
 * - Git protocol: git://github.com/owner/repo.git
 */
const GITHUB_URL_PATTERNS = {
  /**
   * HTTPS format: https://github.com/owner/repo or https://github.com/owner/repo.git
   * Groups: owner, repo
   */
  https: /^https?:\/\/github\.com\/(?<owner>[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?)\/(?<repo>[a-zA-Z0-9._-]+?)(?:\.git)?$/,

  /**
   * SSH format: git@github.com:owner/repo.git
   * Groups: owner, repo
   */
  ssh: /^git@github\.com:(?<owner>[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?)\/(?<repo>[a-zA-Z0-9._-]+?)(?:\.git)?$/,

  /**
   * Git protocol: git://github.com/owner/repo.git
   * Groups: owner, repo
   */
  git: /^git:\/\/github\.com\/(?<owner>[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?)\/(?<repo>[a-zA-Z0-9._-]+?)(?:\.git)?$/,
} as const;

/**
 * Combined pattern for quick URL validation (checks if URL is any valid GitHub format)
 */
const COMBINED_GITHUB_PATTERN = /^(?:https?:\/\/github\.com\/|git@github\.com:|git:\/\/github\.com\/)[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?\/[a-zA-Z0-9._-]+(?:\.git)?$/;

/**
 * Parses a GitHub URL and extracts owner and repository name.
 *
 * Supports the following URL formats:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 * - git://github.com/owner/repo.git
 *
 * @param url - The GitHub repository URL to parse
 * @returns ParsedGitHubUrl with owner and repo, or null if URL is invalid
 *
 * @example
 * ```typescript
 * const result = parseGitHubUrl('https://github.com/facebook/react');
 * // result: { owner: 'facebook', repo: 'react' }
 *
 * const sshResult = parseGitHubUrl('git@github.com:facebook/react.git');
 * // sshResult: { owner: 'facebook', repo: 'react' }
 *
 * const invalid = parseGitHubUrl('https://gitlab.com/user/repo');
 * // invalid: null
 * ```
 */
export function parseGitHubUrl(url: string): ParsedGitHubUrl | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmedUrl = url.trim();

  // Try each pattern in order
  for (const pattern of Object.values(GITHUB_URL_PATTERNS)) {
    const match = trimmedUrl.match(pattern);
    if (match?.groups) {
      const { owner, repo } = match.groups;
      // Remove .git suffix from repo if present (handled by regex but double-check)
      const cleanRepo = repo.replace(/\.git$/, '');
      return {
        owner,
        repo: cleanRepo,
      };
    }
  }

  return null;
}

/**
 * Checks if a URL is a valid GitHub repository URL.
 *
 * This is a quick validation without parsing - use parseGitHubUrl
 * if you need to extract owner/repo information.
 *
 * @param url - The URL to validate
 * @returns true if the URL is a valid GitHub URL, false otherwise
 *
 * @example
 * ```typescript
 * isGitHubUrl('https://github.com/owner/repo'); // true
 * isGitHubUrl('git@github.com:owner/repo.git'); // true
 * isGitHubUrl('https://gitlab.com/owner/repo'); // false
 * isGitHubUrl('not-a-url'); // false
 * ```
 */
export function isGitHubUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  return COMBINED_GITHUB_PATTERN.test(url.trim());
}

/**
 * Normalizes a GitHub URL to the standard HTTPS format.
 *
 * Converts SSH and Git protocol URLs to HTTPS format for consistent handling.
 *
 * @param url - The GitHub URL to normalize
 * @returns Normalized HTTPS URL, or null if URL is invalid
 *
 * @example
 * ```typescript
 * normalizeGitHubUrl('git@github.com:owner/repo.git');
 * // Returns: 'https://github.com/owner/repo'
 *
 * normalizeGitHubUrl('https://github.com/owner/repo.git');
 * // Returns: 'https://github.com/owner/repo'
 * ```
 */
export function normalizeGitHubUrl(url: string): string | null {
  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    return null;
  }

  return `https://github.com/${parsed.owner}/${parsed.repo}`;
}

/**
 * Constructs a GitHub API URL for a repository.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns GitHub API URL for the repository
 *
 * @example
 * ```typescript
 * buildGitHubApiUrl('facebook', 'react');
 * // Returns: 'https://api.github.com/repos/facebook/react'
 * ```
 */
export function buildGitHubApiUrl(owner: string, repo: string): string {
  return `https://api.github.com/repos/${owner}/${repo}`;
}

/**
 * Extracts GitHub repository information from a URL and builds the API URL.
 *
 * Convenience function that combines parseGitHubUrl and buildGitHubApiUrl.
 *
 * @param url - The GitHub repository URL
 * @returns GitHub API URL, or null if URL is invalid
 *
 * @example
 * ```typescript
 * getApiUrlFromRepoUrl('https://github.com/facebook/react');
 * // Returns: 'https://api.github.com/repos/facebook/react'
 * ```
 */
export function getApiUrlFromRepoUrl(url: string): string | null {
  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    return null;
  }

  return buildGitHubApiUrl(parsed.owner, parsed.repo);
}
