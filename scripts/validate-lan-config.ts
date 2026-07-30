import { validateLanDeploymentConfig } from "../lib/domain/lan-deployment";

const config = validateLanDeploymentConfig(process.env.APP_BIND_IP, process.env.APP_ALLOWED_CIDRS);
console.log(`Validated LAN deployment boundary: ${config.bindIp} for ${config.allowedCidrs.join(", ")}`);
