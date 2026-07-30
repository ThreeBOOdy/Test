import { isIP } from "node:net";

export type LanDeploymentConfig = {
  bindIp: string;
  allowedCidrs: string[];
};

export function validateLanDeploymentConfig(bindIpValue: string | undefined, allowedCidrsValue: string | undefined): LanDeploymentConfig {
  const bindIp = bindIpValue?.trim() ?? "";
  if (!isPrivateIpv4(bindIp)) throw new Error("APP_BIND_IP must be a private IPv4 address");

  const allowedCidrs = allowedCidrsValue?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (allowedCidrs.length === 0 || allowedCidrs.some((cidr) => !isPrivateIpv4Cidr(cidr))) {
    throw new Error("APP_ALLOWED_CIDRS must contain only private IPv4 CIDRs");
  }
  if (!allowedCidrs.some((cidr) => ipv4BelongsToCidr(bindIp, cidr))) {
    throw new Error("APP_BIND_IP must belong to APP_ALLOWED_CIDRS");
  }

  return { bindIp, allowedCidrs };
}

function isPrivateIpv4(value: string) {
  if (isIP(value) !== 4) return false;
  const address = ipv4ToNumber(value);
  return isInsideRange(address, "10.0.0.0", 8) || isInsideRange(address, "172.16.0.0", 12) || isInsideRange(address, "192.168.0.0", 16);
}

function isPrivateIpv4Cidr(value: string) {
  const [addressValue, prefixValue, extra] = value.split("/");
  if (extra !== undefined || isIP(addressValue) !== 4 || !/^\d{1,2}$/.test(prefixValue ?? "")) return false;
  const prefix = Number(prefixValue);
  if (prefix < 8 || prefix > 32) return false;

  const address = ipv4ToNumber(addressValue);
  const mask = prefixToMask(prefix);
  if (((address & mask) >>> 0) !== address) return false;
  const lastAddress = (address | (~mask >>> 0)) >>> 0;
  return isPrivateIpv4(numberToIpv4(address)) && isPrivateIpv4(numberToIpv4(lastAddress));
}

function ipv4BelongsToCidr(addressValue: string, cidr: string) {
  const [networkValue, prefixValue] = cidr.split("/");
  const prefix = Number(prefixValue);
  const mask = prefixToMask(prefix);
  return ((ipv4ToNumber(addressValue) & mask) >>> 0) === ipv4ToNumber(networkValue);
}

function isInsideRange(address: number, networkValue: string, prefix: number) {
  const mask = prefixToMask(prefix);
  return ((address & mask) >>> 0) === ipv4ToNumber(networkValue);
}

function ipv4ToNumber(value: string) {
  return value.split(".").reduce((result, octet) => ((result << 8) | Number(octet)) >>> 0, 0);
}

function numberToIpv4(value: number) {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join(".");
}

function prefixToMask(prefix: number) {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}
