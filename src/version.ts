<<<<<<< HEAD
export const version = '0.0.0'
=======
/**
 * Version information for the ollama-js library
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

export interface Version {
  major: number
  minor: number
  patch: number
  prerelease?: string
  build?: string
}

function loadPackageVersion(): Version {
  try {
    const packagePath = resolve(__dirname, '../package.json')
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
    const [major = 0, minor = 0, patch = 0] = packageJson.version.split('.')
    return {
      major: parseInt(major, 10),
      minor: parseInt(minor, 10),
      patch: parseInt(patch, 10)
    }
  } catch (error) {
    console.warn('Failed to load version from package.json:', error)
    return {
      major: 0,
      minor: 0,
      patch: 0
    }
  }
}

/**
 * Current version of the ollama-js library
 */
export const VERSION: Version = loadPackageVersion()

/**
 * Version string in semver format
 */
export const version = `${VERSION.major}.${VERSION.minor}.${VERSION.patch}${VERSION.prerelease ? `-${VERSION.prerelease}` : ''}${VERSION.build ? `+${VERSION.build}` : ''}`

/**
 * Compares two version numbers in semver format
 * @param v1 First version to compare
 * @param v2 Second version to compare
 * @returns -1 if v1 < v2, 0 if v1 = v2, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const v1Parts = v1.split(/[-+]/, 1)[0].split('.')
  const v2Parts = v2.split(/[-+]/, 1)[0].split('.')

  for (let i = 0; i < 3; i++) {
    const num1 = parseInt(v1Parts[i] || '0', 10)
    const num2 = parseInt(v2Parts[i] || '0', 10)

    if (num1 > num2) return 1
    if (num1 < num2) return -1
  }

  return 0
}

/**
 * Checks if the current version satisfies a version requirement
 * @param requirement Version requirement in semver format (e.g. '>= 1.0.0')
 * @returns true if the current version satisfies the requirement
 */
export function satisfiesVersion(requirement: string): boolean {
  const [op, ver] = requirement.trim().split(' ', 2)
  if (!ver) return true

  const comparison = compareVersions(version, ver)

  switch (op) {
    case '>': return comparison > 0
    case '>=': return comparison >= 0
    case '<': return comparison < 0
    case '<=': return comparison <= 0
    case '=':
    case '==': return comparison === 0
    case '!=': return comparison !== 0
    default: return false
  }
}

/**
 * Returns true if the current version is a pre-release version
 */
export function isPrerelease(): boolean {
  return !!VERSION.prerelease
}

/**
 * Returns true if the current version is a development version (0.x.x)
 */
export function isDevelopment(): boolean {
  return VERSION.major === 0
}

/**
 * Returns true if the current version has build metadata
 */
export function hasBuildMetadata(): boolean {
  return !!VERSION.build
}

/**
 * Returns a string representation of the current version with additional details
 */
export function getVersionInfo(): string {
  return `ollama-js v${version}`
}
>>>>>>> e97ea55 (approved-by: farre <farre@cascade.ai>raper project)
