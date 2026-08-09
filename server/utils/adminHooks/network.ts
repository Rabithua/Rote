import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

function normalizeHostname(hostname: string) {
  return hostname.replace(/^\[(.*)\]$/, '$1').toLowerCase();
}

function isUnsafeIPv4(address: string) {
  const octets = address.split('.').map((part) => Number(part));
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true;
  }

  const [first, second] = octets;
  if (first === 0 || first === 10 || first === 127) return true;
  if (first === 100 && second >= 64 && second <= 127) return true;
  if (first === 169 && second === 254) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && (second === 0 || second === 168)) return true;
  if (first === 198 && (second === 18 || second === 19)) return true;
  if (first >= 224) return true;
  return false;
}

function isSyntheticProxyIPv4(address: string) {
  const octets = parseIPv4Octets(address);
  return Boolean(octets && octets[0] === 198 && (octets[1] === 18 || octets[1] === 19));
}

function parseIPv4Octets(address: string) {
  const octets = address.split('.').map((part) => Number(part));
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return null;
  }
  return octets;
}

function replaceEmbeddedIPv4(address: string) {
  if (!address.includes('.')) return address;
  const separator = address.lastIndexOf(':');
  if (separator < 0) return address;

  const octets = parseIPv4Octets(address.slice(separator + 1));
  if (!octets) return address;

  const [first, second, third, fourth] = octets;
  const high = ((first << 8) | second).toString(16);
  const low = ((third << 8) | fourth).toString(16);
  return `${address.slice(0, separator)}:${high}:${low}`;
}

function parseIPv6Segments(address: string) {
  const normalized = replaceEmbeddedIPv4(address.toLowerCase());
  const compressedParts = normalized.split('::');
  if (compressedParts.length > 2) return null;

  const head = compressedParts[0] ? compressedParts[0].split(':') : [];
  const tail = compressedParts[1] ? compressedParts[1].split(':') : [];
  const fillCount = compressedParts.length === 2 ? 8 - head.length - tail.length : 0;
  if (fillCount < 0) return null;

  const rawSegments =
    compressedParts.length === 2 ? [...head, ...Array(fillCount).fill('0'), ...tail] : head;
  if (rawSegments.length !== 8 || rawSegments.some((segment) => !segment)) return null;

  const segments = rawSegments.map((segment) => Number.parseInt(segment, 16));
  if (segments.some((segment) => !Number.isFinite(segment) || segment < 0 || segment > 0xffff)) {
    return null;
  }
  return segments;
}

function mappedIPv4FromIPv6(address: string) {
  const segments = parseIPv6Segments(address);
  if (!segments) return null;

  const isMapped = segments.slice(0, 5).every((segment) => segment === 0) && segments[5] === 0xffff;
  if (!isMapped) return null;

  const high = segments[6];
  const low = segments[7];
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
}

function isUnsafeIPv6(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === '::' || normalized === '::1') return true;

  const mappedIPv4 = mappedIPv4FromIPv6(normalized);
  if (mappedIPv4) return isUnsafeIPv4(mappedIPv4);

  const firstSegment = Number.parseInt(normalized.split(':')[0] || '0', 16);
  if (!Number.isFinite(firstSegment)) return true;
  if ((firstSegment & 0xfe00) === 0xfc00) return true;
  if ((firstSegment & 0xffc0) === 0xfe80) return true;
  if ((firstSegment & 0xff00) === 0xff00) return true;
  return false;
}

function isUnsafeIpAddress(address: string) {
  const version = isIP(address);
  if (version === 4) return isUnsafeIPv4(address);
  if (version === 6) return isUnsafeIPv6(address);
  return true;
}

function isBlockedHostname(hostname: string) {
  const normalized = normalizeHostname(hostname);
  return (
    normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.endsWith('.local')
  );
}

export function normalizeUrlBase(value: string) {
  return value.replace(/\/+$/, '');
}

export function validateHttpUrl(value: string, label: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${label} must use http or https`);
  }
  const hostname = normalizeHostname(url.hostname);
  if (isBlockedHostname(hostname) || (isIP(hostname) && isUnsafeIpAddress(hostname))) {
    throw new Error(`${label} must not target local or private network addresses`);
  }
  return url;
}

export async function assertSafeOutboundUrl(value: string, label: string) {
  const url = validateHttpUrl(value, label);
  const hostname = normalizeHostname(url.hostname);
  if (isIP(hostname)) return;

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  const allowSyntheticProxyDns = process.env.ALLOW_SYNTHETIC_PROXY_DNS === 'true';
  if (
    addresses.length === 0 ||
    addresses.some(
      (address) =>
        isUnsafeIpAddress(address.address) &&
        !(allowSyntheticProxyDns && isSyntheticProxyIPv4(address.address))
    )
  ) {
    throw new Error(`${label} must not resolve to local or private network addresses`);
  }
}
