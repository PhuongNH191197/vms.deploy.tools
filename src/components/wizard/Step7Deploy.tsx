import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, Circle, Rocket } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useWizardStore } from "@/store/wizardStore";
import { useServerStore } from "@/store/serverStore";
import type { DeployStep, DeployStepStatus, ExternalServiceConfig } from "@/store/wizardStore";
import { generateCombinedCompose } from "@/lib/composeGenerator";

interface DeployEvent {
  step_id: string;
  line: string;
  done: boolean;
  error: boolean;
}

function StepBadge({ status }: { status: DeployStepStatus }) {
  switch (status) {
    case "running": return <Badge className="bg-blue-600 text-xs gap-1"><Loader2 size={10} className="animate-spin" />Running</Badge>;
    case "done":    return <Badge className="bg-green-600 text-xs gap-1"><CheckCircle2 size={10} />Done</Badge>;
    case "failed":  return <Badge variant="destructive" className="text-xs gap-1"><XCircle size={10} />Failed</Badge>;
    default:        return <Badge variant="outline" className="text-xs gap-1"><Circle size={10} />Pending</Badge>;
  }
}

function buildDeploySteps(
  selectedExternals: ExternalServiceConfig[],
  apps: { name: string; source: string; gitUrl?: string; gitBranch?: string; tarServerPath?: string }[],
): DeployStep[] {
  const steps: DeployStep[] = [
    { id: "dirs", label: "Tạo thư mục", status: "pending" },
    { id: "vms_env", label: "Ghi vms.env", status: "pending" },
  ];

  if (selectedExternals.length > 0) {
    steps.push({ id: "externals", label: `Khởi động ${selectedExternals.length} external service(s)`, status: "pending" });
  }

  if (apps.length > 0) {
    steps.push({ id: "apps", label: `Deploy ${apps.length} application(s)`, status: "pending" });
  }

  steps.push({ id: "healthcheck", label: "Healthcheck (docker ps)", status: "pending" });
  return steps;
}

export default function Step7Deploy() {
  const {
    selectedServerId, credential, rootPath,
    selectedExternals, apps, envVars, dockerNetworks,
    deploySteps, setDeploySteps, updateDeployStep,
    prevStep, reset,
  } = useWizardStore();
  const { servers } = useServerStore();
  const server = servers.find((s) => s.id === selectedServerId);

  const [deploying, setDeploying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const EVENT_ID = useRef(`deploy-${Date.now()}`).current;

  // Build steps on first render / when deps change
  useEffect(() => {
    if (deploySteps.length === 0) {
      setDeploySteps(buildDeploySteps(selectedExternals, apps));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll logs to bottom
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [logs]);

  const appendLog = (line: string) => setLogs((p) => [...p, line]);

  const runStep = async (
    stepId: string,
    commands: string[],
  ) => {
    if (!server || commands.length === 0) {
      updateDeployStep(stepId, { status: "done" });
      return;
    }

    updateDeployStep(stepId, { status: "running" });

    try {
      await invoke("run_deploy_step", {
        host: server.host, port: server.port,
        username: server.username, authType: server.auth_type, credential,
        commands, eventId: EVENT_ID, stepId,
      });
      updateDeployStep(stepId, { status: "done" });
    } catch (e) {
      updateDeployStep(stepId, { status: "failed", error: String(e) });
      throw e;
    }
  };

  const buildEnvContent = () => {
    const lines = ["# vms.env"];
    for (const svc of selectedExternals) {
      const vars = envVars[svc.name] ?? [];
      if (vars.length === 0) continue;
      lines.push(`# ${svc.displayName}`);
      vars.forEach((v) => { if (v.key.trim()) lines.push(`${v.key}=${v.value}`); });
      lines.push("");
    }
    return lines.join("\n");
  };

  const handleDeploy = async () => {
    if (!server) return;
    setDeploying(true);
    setFinished(false);
    setLogs([]);

    // Re-init steps
    const freshSteps = buildDeploySteps(selectedExternals, apps);
    setDeploySteps(freshSteps);

    // Subscribe to deploy events
    const unlisten = await listen<DeployEvent>(EVENT_ID, (ev) => {
      const { line, done, error } = ev.payload;
      if (line) appendLog(error ? `[ERR] ${line}` : line);
      if (done && !error) appendLog("");
    });

    try {
      // Step 1: create dirs
      const appDirs = apps.map((a) => `${rootPath}/apps/${a.name.replace(/[^a-z0-9_-]/gi, "_").toLowerCase()}`);
      const extDirs = selectedExternals.map((e) => `${rootPath}/external/${e.name}`);
      const mkdirCmd = `mkdir -p ${rootPath} ${[...extDirs, ...appDirs].join(" ")}`;
      await runStep("dirs", [mkdirCmd]);

      // Step 2: write vms.env
      updateDeployStep("vms_env", { status: "running" });
      const envContent = buildEnvContent();
      await invoke("write_vms_env", {
        host: server.host, port: server.port,
        username: server.username, authType: server.auth_type, credential,
        rootPath, content: envContent,
      });
      appendLog(`Wrote ${rootPath}/vms.env`);
      updateDeployStep("vms_env", { status: "done" });

      // Step 3: upload files then start externals
      if (selectedExternals.length > 0) {
        updateDeployStep("externals", { status: "running" });
        try {
          for (const svc of selectedExternals) {
            const dir = `${rootPath}/external/${svc.name}`;

            // Upload .tar image for offline mode
            if (svc.source === "offline" && svc.tarPath.trim()) {
              const tarName = svc.tarPath.split(/[\\/]/).pop() ?? `${svc.name}.tar`;
              appendLog(`↑ Upload ${tarName} → ${dir}/`);
              await invoke("upload_path", {
                host: server.host, port: server.port,
                username: server.username, authType: server.auth_type, credential,
                localPath: svc.tarPath,
                remotePath: `${dir}/${tarName}`,
                eventId: `${EVENT_ID}-tar-${svc.name}`,
              });
            }

            // Upload compose folder (both online and offline)
            if (svc.composeFolderPath.trim()) {
              appendLog(`↑ Upload compose/${svc.name} → ${dir}/`);
              await invoke("upload_path", {
                host: server.host, port: server.port,
                username: server.username, authType: server.auth_type, credential,
                localPath: svc.composeFolderPath,
                remotePath: dir,
                eventId: `${EVENT_ID}-compose-${svc.name}`,
              });
            }
          }

          // Build and run docker commands
          const extCmds = selectedExternals.flatMap((svc) => {
            const dir = `${rootPath}/external/${svc.name}`;
            const cmds: string[] = [];
            if (svc.source === "offline" && svc.tarPath.trim()) {
              const tarName = svc.tarPath.split(/[\\/]/).pop() ?? `${svc.name}.tar`;
              cmds.push(`docker load < ${dir}/${tarName} 2>&1`);
            } else {
              cmds.push(`cd ${dir} && docker-compose pull 2>&1 || true`);
            }
            cmds.push(`cd ${dir} && docker-compose up -d 2>&1`);
            return cmds;
          });

          await invoke("run_deploy_step", {
            host: server.host, port: server.port,
            username: server.username, authType: server.auth_type, credential,
            commands: extCmds, eventId: EVENT_ID, stepId: "externals",
          });
          updateDeployStep("externals", { status: "done" });
        } catch (e) {
          updateDeployStep("externals", { status: "failed", error: String(e) });
          throw e;
        }
      }

      // Step 4: deploy apps
      if (apps.length > 0) {
        // Only write docker-compose.yml if there are non-git apps (git apps use CI/CD)
        const composableApps = apps.filter((a) => a.source !== "git");
        if (composableApps.length > 0) {
          const composeContent = generateCombinedCompose(apps, dockerNetworks, rootPath);
          await invoke("write_remote_file", {
            host: server.host, port: server.port,
            username: server.username, authType: server.auth_type, credential,
            remotePath: `${rootPath}/docker-compose.yml`,
            content: composeContent,
          });
          appendLog(`Wrote ${rootPath}/docker-compose.yml`);
        }

        const appCmds = apps.flatMap((app) => {
          const slug = app.name.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
          const dir = `${rootPath}/apps/${slug}`;
          const cmds = [];
          if (app.source === "git" && app.gitUrl) {
            const branch = app.gitBranch || "main";
            if (app.gitToken) {
              const url = app.gitUrl.replace("https://", `https://${app.gitToken}@`);
              cmds.push(`git -C ${dir} pull 2>&1 || git clone -b ${branch} ${url} ${dir} 2>&1`);
            } else {
              const gitAs = `sudo -u gitlab-runner env HOME=/home/gitlab-runner GIT_CONFIG_GLOBAL=/home/gitlab-runner/.gitconfig`;
              cmds.push(`sudo chown -R gitlab-runner:gitlab-runner ${dir} 2>/dev/null; ${gitAs} git -C ${dir} pull 2>&1 || ${gitAs} git clone -b ${branch} ${app.gitUrl} ${dir} 2>&1`);
            }
          } else if (app.source === "offline" && app.tarServerPath) {
            cmds.push(`docker load < ${app.tarServerPath} 2>&1`);
          }
          // git source: CI/CD handles build & deploy — skip docker-compose up
          if (app.source !== "git") {
            cmds.push(`cd ${rootPath} && docker-compose up -d ${slug} 2>&1`);
          }
          return cmds;
        });
        await runStep("apps", appCmds);
      }

      // Step 5: healthcheck
      await runStep("healthcheck", [
        `docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}" 2>&1`,
      ]);

      // Save deploy record
      const moduleNames = apps.map((a) => a.name).join(",") || "externals-only";
      await invoke("save_deploy_record", {
        serverId: server.id,
        moduleName: moduleNames,
        moduleVersion: "latest",
        action: "install",
        status: "success",
        composeBackup: "",
        imageTag: "latest",
      }).catch(() => {}); // non-fatal

      setFinished(true);
    } catch {
      // step already marked failed
    } finally {
      unlisten();
      setDeploying(false);
    }
  };

  const stepsToShow = deploySteps.length > 0
    ? deploySteps
    : buildDeploySteps(selectedExternals, apps);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Bước 7 — Deploy Execution</h2>
        <p className="text-sm text-muted-foreground">
          Server: <code className="font-mono">{server?.host}</code> — Root: <code className="font-mono">{rootPath}</code>
        </p>
      </div>

      {/* Step plan */}
      <div className="border rounded-lg divide-y">
        {stepsToShow.map((step, i) => (
          <div key={step.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="text-xs text-muted-foreground w-5 text-center">{i + 1}</span>
            <span className="text-sm flex-1">{step.label}</span>
            <StepBadge status={step.status} />
            {step.error && <span className="text-xs text-destructive truncate max-w-[160px]">{step.error}</span>}
          </div>
        ))}
      </div>

      {/* Terminal */}
      {(deploying || logs.length > 0) && (
        <div
          ref={logRef}
          className="h-48 overflow-y-auto bg-[#0d1117] rounded-lg p-3 font-mono text-xs text-green-400 space-y-0.5"
        >
          {logs.map((line, i) => (
            <div key={i} className={line.startsWith("[ERR]") ? "text-red-400" : ""}>
              {line || " "}
            </div>
          ))}
          {deploying && <div className="animate-pulse">▊</div>}
        </div>
      )}

      {finished && (
        <p className="text-sm text-green-500 flex items-center gap-1">
          <CheckCircle2 size={14} />Deploy hoàn thành!
        </p>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={prevStep} disabled={deploying}>← Quay lại</Button>
        <div className="flex gap-2">
          {finished && <Button variant="outline" onClick={reset}>Reset Wizard</Button>}
          <Button onClick={handleDeploy} disabled={deploying || !server}>
            {deploying ? <><Loader2 size={13} className="mr-1 animate-spin" />Deploying…</> : <><Rocket size={13} className="mr-1" />Start Deploy</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
