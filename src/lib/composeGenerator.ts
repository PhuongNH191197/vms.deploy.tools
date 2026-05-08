import type { AppModule } from "@/store/wizardStore";

export function generateCombinedCompose(
  apps: AppModule[],
  networks: string[],
  rootPath: string,
): string {
  if (apps.length === 0) return "# No applications configured";
  let yaml = `version: "3.8"\n\nservices:\n`;

  for (const app of apps) {
    const svc = app.name.replace(/[^a-z0-9_-]/gi, "_").toLowerCase() || "app";
    yaml += `  ${svc}:\n`;
    if (app.source === "online") {
      yaml += `    image: ${app.image || svc}:${app.version || "latest"}\n`;
    } else if (app.source === "offline") {
      yaml += `    image: ${svc}:loaded\n`;
    } else {
      yaml += `    build: ${rootPath}/apps/${svc}\n`;
    }
    yaml += `    env_file:\n      - ${rootPath}/vms.env\n`;
    yaml += `    restart: unless-stopped\n`;
    if (networks.length > 0) {
      yaml += `    networks:\n`;
      networks.forEach((n) => (yaml += `      - ${n}\n`));
    }
    yaml += "\n";
  }

  if (networks.length > 0) {
    yaml += `networks:\n`;
    networks.forEach((n) => (yaml += `  ${n}:\n    external: true\n`));
  }

  return yaml;
}
