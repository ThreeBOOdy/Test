import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isImportBatchExpired } from "../lib/domain/import-batch";
import { isLoginBlocked, validatePasswordPolicy } from "../lib/domain/security";
import { ApiError, mapPublicError } from "../lib/domain/api-error";
import { assertRequestBodySize, readJsonBody } from "../lib/domain/request-body";
import { normalizePagination } from "../lib/server/pagination";
import { register } from "../instrumentation";
import { validateLanDeploymentConfig } from "../lib/domain/lan-deployment";

const root = path.resolve(__dirname, "..");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("import batch expiry", () => {
  it("expires previews after 24 hours", () => {
    const createdAt = new Date("2026-07-20T00:00:00.000Z");
    expect(isImportBatchExpired(createdAt, new Date("2026-07-20T23:59:59.000Z"))).toBe(false);
    expect(isImportBatchExpired(createdAt, new Date("2026-07-21T00:00:00.000Z"))).toBe(true);
  });
});

describe("password policy", () => {
  it("requires 6 to 128 characters without composition rules", () => {
    expect(validatePasswordPolicy("1234567", "STUDENT")).toBe("学生密码至少需要 8 位");
    expect(validatePasswordPolicy("12345678", "STUDENT")).toBeNull();
    expect(validatePasswordPolicy("12345678901", "TEACHER")).toBe("教师和管理员密码至少需要 12 位");
    expect(validatePasswordPolicy("中文密码12345678", "ADMIN")).toBeNull();
  });
});

describe("login throttling", () => {
  it("blocks after five failures inside fifteen minutes", () => {
    const now = new Date("2026-07-21T12:00:00.000Z");
    const recentFailures = Array.from({ length: 5 }, (_, index) => new Date(now.getTime() - index * 60_000));
    expect(isLoginBlocked(recentFailures, now)).toBe(true);
    expect(isLoginBlocked(recentFailures.slice(0, 4), now)).toBe(false);
    expect(isLoginBlocked([new Date("2026-07-21T11:44:59.000Z"), ...recentFailures.slice(0, 4)], now)).toBe(false);
  });
});

describe("pagination", () => {
  it("applies safe defaults and limits", () => {
    expect(normalizePagination({})).toEqual({ page: 1, pageSize: 20, skip: 0 });
    expect(normalizePagination({ page: "3", pageSize: "500" })).toEqual({ page: 3, pageSize: 100, skip: 200 });
    expect(normalizePagination({ page: "-1", pageSize: "0" })).toEqual({ page: 1, pageSize: 20, skip: 0 });
  });
});

describe("API error mapping", () => {
  it("preserves typed public API errors", () => {
    expect(mapPublicError(new ApiError("批次已过期", 409), "提交失败", false)).toEqual({ message: "批次已过期", status: 409 });
  });

  it("hides unexpected error details in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(mapPublicError(new Error("database connection details"), "请求失败", true)).toEqual({ message: "请求失败", status: 500 });
  });
});

describe("request body limits", () => {
  it("rejects an oversized multipart request before parsing", () => {
    const request = new Request("http://localhost/api", { method: "POST", headers: { "content-length": "21" }, body: "file" });
    expect(() => assertRequestBodySize(request, 20)).toThrowError(new ApiError("请求体过大", 413));
  });

  it("rejects declared and streamed JSON bodies above the limit", async () => {
    const declared = new Request("http://localhost/api", { method: "POST", headers: { "content-length": "20" }, body: "{}" });
    await expect(readJsonBody(declared, 10)).rejects.toMatchObject({ status: 413 });

    const streamed = new Request("http://localhost/api", { method: "POST", body: JSON.stringify({ value: "1234567890" }) });
    await expect(readJsonBody(streamed, 10)).rejects.toMatchObject({ status: 413 });
  });

  it("parses valid JSON and rejects malformed JSON", async () => {
    const valid = new Request("http://localhost/api", { method: "POST", body: JSON.stringify({ value: 1 }) });
    await expect(readJsonBody(valid, 1024)).resolves.toEqual({ value: 1 });

    const malformed = new Request("http://localhost/api", { method: "POST", body: "{" });
    await expect(readJsonBody(malformed, 1024)).rejects.toEqual(new ApiError("请求体不是有效 JSON", 400));
  });
});

describe("production startup", () => {
  const encryptionKey = Buffer.alloc(32, 17).toString("base64");
  const hashKey = Buffer.alloc(32, 29).toString("base64");

  it("rejects missing student data secrets in the production Node runtime", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("STUDENT_DATA_ENCRYPTION_KEY", "");
    vi.stubEnv("STUDENT_DATA_HASH_KEY", "");

    await expect(register()).rejects.toThrowError("STUDENT_DATA_ENCRYPTION_KEY must be a Base64-encoded 32-byte key");
  });

  it("accepts valid student data secrets in the production Node runtime", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("STUDENT_DATA_ENCRYPTION_KEY", encryptionKey);
    vi.stubEnv("STUDENT_DATA_HASH_KEY", hashKey);

    await expect(register()).resolves.toBeUndefined();
  });

  it("skips Node-only student data validation in the edge runtime", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_RUNTIME", "edge");
    vi.stubEnv("STUDENT_DATA_ENCRYPTION_KEY", "");
    vi.stubEnv("STUDENT_DATA_HASH_KEY", "");

    await expect(register()).resolves.toBeUndefined();
  });

  it("maps both student data secrets into the production app container", () => {
    const compose = fs.readFileSync(path.join(root, "docker-compose.prod.yml"), "utf8");

    expect(compose).toContain("STUDENT_DATA_ENCRYPTION_KEY: ${STUDENT_DATA_ENCRYPTION_KEY}");
    expect(compose).toContain("STUDENT_DATA_HASH_KEY: ${STUDENT_DATA_HASH_KEY}");
  });
});

describe("LAN HTTPS deployment boundary", () => {
  it("accepts only explicit private IPv4 deployment boundaries", () => {
    expect(validateLanDeploymentConfig("192.168.50.10", "192.168.50.0/24")).toEqual({ bindIp: "192.168.50.10", allowedCidrs: ["192.168.50.0/24"] });
    expect(validateLanDeploymentConfig("10.20.30.40", "10.20.0.0/16 10.30.0.0/16")).toEqual({ bindIp: "10.20.30.40", allowedCidrs: ["10.20.0.0/16", "10.30.0.0/16"] });

    expect(() => validateLanDeploymentConfig("0.0.0.0", "0.0.0.0/0")).toThrow("APP_BIND_IP must be a private IPv4 address");
    expect(() => validateLanDeploymentConfig("127.0.0.1", "127.0.0.0/8")).toThrow("APP_BIND_IP must be a private IPv4 address");
    expect(() => validateLanDeploymentConfig("203.0.113.10", "203.0.113.0/24")).toThrow("APP_BIND_IP must be a private IPv4 address");
    expect(() => validateLanDeploymentConfig("192.168.50.10", "0.0.0.0/0")).toThrow("APP_ALLOWED_CIDRS must contain only private IPv4 CIDRs");
    expect(() => validateLanDeploymentConfig("192.168.50.10", "10.0.0.0/8")).toThrow("APP_BIND_IP must belong to APP_ALLOWED_CIDRS");
  });

  it("requires an explicit LAN IP and only publishes Caddy on that address", () => {
    const compose = fs.readFileSync(path.join(root, "docker-compose.prod.yml"), "utf8");
    const envExample = fs.readFileSync(path.join(root, ".env.example"), "utf8");

    expect(envExample).toContain('APP_BIND_IP="192.168.50.10"');
    expect(envExample).toContain('APP_ALLOWED_CIDRS="192.168.50.0/24"');
    expect(envExample).not.toContain("APP_DOMAIN=");
    expect(compose).toContain('${APP_BIND_IP:?APP_BIND_IP must be set}:80:80');
    expect(compose).toContain('${APP_BIND_IP:?APP_BIND_IP must be set}:443:443');
    expect(compose).not.toMatch(/^\s+-\s+"?(80|443):\1"?\s*$/m);
    expect(compose).toContain('command: ["npx", "tsx", "scripts/validate-lan-config.ts"]');
    expect(compose).toMatch(/migrate:[\s\S]*?lan-config:\s*\r?\n\s+condition: service_completed_successfully/);
  });

  it("uses Caddy internal CA and rejects clients outside approved CIDRs", () => {
    const caddyfile = fs.readFileSync(path.join(root, "Caddyfile"), "utf8");

    expect(caddyfile).toContain("http://{$APP_BIND_IP}");
    expect(caddyfile).toContain("redir https://{$APP_BIND_IP}{uri} permanent");
    expect(caddyfile).toContain("https://{$APP_BIND_IP}");
    expect(caddyfile).toContain("tls internal");
    expect(caddyfile).toContain("not remote_ip {$APP_ALLOWED_CIDRS}");
    expect(caddyfile).toContain('respond @unauthorized "Forbidden" 403');
  });

  it("keeps MySQL private and separates proxy and database networks", () => {
    const compose = fs.readFileSync(path.join(root, "docker-compose.prod.yml"), "utf8");
    const databaseService = compose.slice(compose.indexOf("  db:"), compose.indexOf("\n  migrate:"));
    const proxyService = compose.slice(compose.indexOf("  proxy:"), compose.indexOf("\nvolumes:"));

    expect(databaseService).not.toContain("ports:");
    expect(compose).toMatch(/backend:\r?\n\s+driver: bridge\r?\n\s+internal: true/);
    expect(proxyService).toMatch(/networks:\s*\r?\n\s*- frontend/);
    expect(proxyService).not.toContain("- backend");
  });

  it("ships certificate, firewall, and acceptance automation", () => {
    for (const script of ["export-internal-ca.ps1", "install-internal-ca.ps1", "configure-lan-firewall.ps1", "new-public-boundary-record.ps1", "test-lan-deployment.ps1"]) {
      expect(fs.existsSync(path.join(root, "scripts", script)), `${script} should exist`).toBe(true);
    }

    const firewallScript = fs.readFileSync(path.join(root, "scripts", "configure-lan-firewall.ps1"), "utf8");
    const installScript = fs.readFileSync(path.join(root, "scripts", "install-internal-ca.ps1"), "utf8");
    const exportScript = fs.readFileSync(path.join(root, "scripts", "export-internal-ca.ps1"), "utf8");
    const publicBoundaryScript = fs.readFileSync(path.join(root, "scripts", "new-public-boundary-record.ps1"), "utf8");
    const acceptanceScript = fs.readFileSync(path.join(root, "scripts", "test-lan-deployment.ps1"), "utf8");
    expect(firewallScript).toContain("AllowedRemoteAddress must contain only private IPv4 CIDRs");
    expect(firewallScript).toContain("Every Windows Firewall profile must be enabled");
    expect(firewallScript).toContain("ValidateOnly");
    expect(firewallScript).toContain("Test-IPv4InCidr");
    expect(firewallScript).toContain("The HTTPS firewall rule does not match the approved LAN boundary");
    expect(firewallScript).toContain("firewall-audit.json");
    expect(installScript).toContain("ExpectedSha256Fingerprint");
    expect(installScript).toContain("The CA certificate SHA-256 fingerprint does not match the trusted value");
    expect(installScript).toContain("Remove the verified previous Caddy internal CA certificate");
    expect(exportScript).toContain("SHA-256 fingerprint");
    expect(publicBoundaryScript).toContain("globally routable public IPv4 address");
    expect(publicBoundaryScript).toContain("Public boundary record SHA-256");
    expect(acceptanceScript).toContain('ParameterSetName = "Public"');
    expect(acceptanceScript).toContain("Test-GloballyRoutablePublicIPv4");
    expect(acceptanceScript).toMatch(/if \(-not \(Test-GloballyRoutablePublicIPv4 \$PublicTarget\)\)[\s\S]*?Test-PublicBoundaryRecord/);
    expect(acceptanceScript).toContain("Public TCP $port is unreachable");
    expect(acceptanceScript).toContain("FirewallEvidencePath");
    expect(acceptanceScript).toContain("ExpectedFirewallEvidenceSha256");
    expect(acceptanceScript).toContain("Test-FirewallEvidence");
    expect(acceptanceScript).toContain("PublicBoundaryRecordPath");
    expect(acceptanceScript).toContain("ConnectivityControlHost");

    const acceptance = fs.readFileSync(path.join(root, "docs", "operations", "lan-https-acceptance.md"), "utf8");
    expect(acceptance).toContain("受管设备无证书警告");
    expect(acceptance).toContain("未授权网段");
    expect(acceptance).toContain("3306");
  });
});
