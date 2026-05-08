// Step 2 — Kiểm tra & Cài đặt Môi trường
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Loader2, Download } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { checkEnvTools, installEnvTool, listSupportedTools, runAptUpdate } from "@/lib/tauri/commands";
import { useWizardStore } from "@/store/wizardStore";
import { useServerStore } from "@/store/serverStore";
import type { ToolCheckResult, ToolMeta } from "@/types";

export default function Step2EnvCheck() {
  const { selectedServerId, credential, setEnvResults, nextStep, prevStep } = useWizardStore();
  const { servers } = useServerStore();
  const server = servers.find((s) => s.id === selectedServerId);

  const [allMeta, setAllMeta] = useState<ToolMeta[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState<ToolCheckResult[]>([]);
  const [installingTools, setInstallingTools] = useState<Set<string>>(new Set());
  const [installLogs, setInstallLogs] = useState<string[]>([]);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const aptUpdatedRef = useRef(false);

  useEffect(() => {
    listSupportedTools().then((meta) => {
      setAllMeta(meta);
      setSelected(new Set(meta.map((m) => m.name)));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [installLogs]);

  if (!server) return null;

  const toggleTool = (name: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });

  const selectAll = () => setSelected(new Set(allMeta.map((m) => m.name)));
  const deselectAll = () => setSelected(new Set());
  const allSelected = allMeta.length > 0 && selected.size === allMeta.length;

  const appendLog = (line: string) => setInstallLogs((p) => [...p, line]);

  const recheckTool = async (toolName: string) => {
    try {
      const res = await checkEnvTools({
        host: server.host, port: server.port,
        username: server.username, authType: server.auth_type,
        credential, tools: [toolName],
      });
      if (res.length > 0) {
        setResults((prev) => {
          const next = [...prev];
          const idx = next.findIndex((r) => r.name === toolName);
          if (idx >= 0) next[idx] = res[0];
          else next.push(res[0]);
          return next;
        });
      }
    } catch (e) {
      appendLog(`[ERR] recheck ${toolName}: ${String(e)}`);
    }
  };

  const handleCheck = async () => {
    if (selected.size === 0) return;
    setChecking(true); setError(""); setResults([]);
    try {
      const res = await checkEnvTools({
        host: server.host, port: server.port,
        username: server.username, authType: server.auth_type,
        credential, tools: [...selected],
      });
      setResults(res);
      setEnvResults(res);
    } catch (e) { setError(String(e)); }
    finally { setChecking(false); }
  };

  const handleInstallAll = async () => {
    const toInstall = results.filter((r) => !r.installed);
    if (toInstall.length === 0) return;
    setInstalling(true);
    setInstallLogs([]);

    // Run apt-get update once before all installs
    const updateEid = `wiz-apt-update-${Date.now()}`;
    appendLog("▶ apt-get update...");
    const unlistenUpdate = await listen<{ line: string; done: boolean; error: boolean }>(
      updateEid,
      (ev) => { if (ev.payload.line) appendLog(ev.payload.line); }
    );
    try {
      await runAptUpdate({
        host: server.host, port: server.port,
        username: server.username, authType: server.auth_type,
        credential, eventId: updateEid,
      });
      aptUpdatedRef.current = true;
      appendLog("✓ apt-get update done\n");
    } catch {
      appendLog("[WARN] apt-get update failed — install may still work with cached lists\n");
    } finally {
      unlistenUpdate();
    }

    for (const tool of toInstall) {
      const eid = `wiz-install-${tool.name}-${Date.now()}`;
      setInstallingTools((prev) => new Set([...prev, tool.name]));
      appendLog(`\n▶ Installing ${tool.name}...`);

      const unlisten = await listen<{ line: string; done: boolean; error: boolean }>(
        eid,
        (ev) => {
          const { line, done, error: isErr } = ev.payload;
          if (line) appendLog(isErr ? `[ERR] ${line}` : line);
          if (done && !isErr) appendLog("");
        }
      );

      try {
        await installEnvTool({
          host: server.host, port: server.port,
          username: server.username, authType: server.auth_type,
          credential, tool: tool.name, eventId: eid,
        });
        appendLog(`✓ ${tool.name} — done`);
      } catch (e) {
        appendLog(`✗ ${tool.name} — failed: ${String(e)}`);
      } finally {
        unlisten();
        await recheckTool(tool.name);
        setInstallingTools((prev) => {
          const next = new Set(prev);
          next.delete(tool.name);
          return next;
        });
      }
    }

    setInstalling(false);

    // Full recheck after all installs — source of truth for final state
    appendLog("\n▶ Re-checking all tools...");
    setChecking(true);
    try {
      const res = await checkEnvTools({
        host: server.host, port: server.port,
        username: server.username, authType: server.auth_type,
        credential, tools: [...selected],
      });
      setResults(res);
      setEnvResults(res);
      const nowOk = res.filter((r) => r.installed).length;
      appendLog(`✓ Check done: ${nowOk}/${res.length} installed`);
    } catch (e) {
      appendLog(`[ERR] final check: ${String(e)}`);
    } finally {
      setChecking(false);
    }
  };

  const handleInstallSingle = async (toolName: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (installing || installingTools.has(toolName)) return;

    setInstallingTools((prev) => new Set([...prev, toolName]));

    if (!aptUpdatedRef.current) {
      const updateEid = `wiz-apt-update-${Date.now()}`;
      appendLog("▶ apt-get update...");
      const unlistenUpdate = await listen<{ line: string; done: boolean; error: boolean }>(
        updateEid,
        (ev) => { if (ev.payload.line) appendLog(ev.payload.line); }
      );
      try {
        await runAptUpdate({
          host: server.host, port: server.port,
          username: server.username, authType: server.auth_type,
          credential, eventId: updateEid,
        });
        aptUpdatedRef.current = true;
        appendLog("✓ apt-get update done\n");
      } catch {
        appendLog("[WARN] apt-get update failed\n");
      } finally {
        unlistenUpdate();
      }
    }

    const eid = `wiz-install-${toolName}-${Date.now()}`;
    appendLog(`\n▶ Installing ${toolName}...`);
    const unlisten = await listen<{ line: string; done: boolean; error: boolean }>(
      eid,
      (ev) => {
        const { line, done, error: isErr } = ev.payload;
        if (line) appendLog(isErr ? `[ERR] ${line}` : line);
        if (done && !isErr) appendLog("");
      }
    );
    try {
      await installEnvTool({
        host: server.host, port: server.port,
        username: server.username, authType: server.auth_type,
        credential, tool: toolName, eventId: eid,
      });
      appendLog(`✓ ${toolName} — done`);
    } catch (err) {
      appendLog(`✗ ${toolName} — failed: ${String(err)}`);
    } finally {
      unlisten();
      await recheckTool(toolName);
      setInstallingTools((prev) => {
        const next = new Set(prev);
        next.delete(toolName);
        return next;
      });
    }
  };

  const resultMap = new Map(results.map((r) => [r.name, r]));
  const installed = results.filter((r) => r.installed);
  const missing   = results.filter((r) => !r.installed);
  const progress  = results.length > 0 ? Math.round((installed.length / results.length) * 100) : 0;
  const allOk     = results.length > 0 && missing.length === 0;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Bước 2 — Kiểm tra & Cài đặt Môi trường</h2>
        <p className="text-sm text-muted-foreground">Server: <code className="font-mono">{server.host}</code></p>
      </div>

      {/* Tool selector */}
      <div className="border rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Chọn công cụ cần kiểm tra</p>
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={allSelected ? deselectAll : selectAll}>
            {allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {allMeta.map((m) => {
            const r = resultMap.get(m.name);
            const isInstalling = installingTools.has(m.name);
            return (
              <label key={m.name} className="flex items-start gap-2 cursor-pointer group">
                <Checkbox
                  checked={selected.has(m.name)}
                  onCheckedChange={() => toggleTool(m.name)}
                  className="mt-0.5"
                  disabled={isInstalling}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-mono">{m.name}</span>
                    {isInstalling && <Loader2 size={12} className="text-blue-500 animate-spin shrink-0" />}
                    {!isInstalling && r?.installed && <CheckCircle2 size={12} className="text-green-500 shrink-0" />}
                    {!isInstalling && r && !r.installed && (
                      <>
                        <XCircle size={12} className="text-destructive shrink-0" />
                        <button
                          type="button"
                          className="ml-0.5 text-[10px] px-1.5 leading-4 h-4 rounded border border-destructive/50 text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed"
                          disabled={installing || installingTools.size > 0}
                          onClick={(e) => handleInstallSingle(m.name, e)}
                        >
                          Install
                        </button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-tight">{m.description}</p>
                  {r?.installed && r.version && (
                    <p className="text-[10px] text-green-600 font-mono truncate">{r.version}</p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button onClick={handleCheck} disabled={checking || installing || selected.size === 0}>
          {checking && <Loader2 size={14} className="mr-1 animate-spin" />}
          Check ({selected.size})
        </Button>
        {missing.length > 0 && (
          <Button variant="outline" onClick={handleInstallAll} disabled={installing}>
            {installing
              ? <Loader2 size={13} className="mr-1 animate-spin" />
              : <Download size={13} className="mr-1" />}
            {installing ? `Installing… (${installingTools.size} left)` : `Install Missing (${missing.length})`}
          </Button>
        )}
      </div>

      {/* Progress bar */}
      {results.length > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{installed.length}/{results.length} installed</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Real-time install terminal */}
      {installLogs.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Install Log</p>
          <div
            ref={logRef}
            className="h-48 overflow-y-auto bg-[#0d1117] rounded-lg p-3 font-mono text-xs text-green-400 space-y-0.5"
          >
            {installLogs.map((line, i) => (
              <div
                key={i}
                className={
                  line.startsWith("[ERR]") ? "text-red-400" :
                  line.startsWith("✓") ? "text-green-300 font-semibold" :
                  line.startsWith("✗") ? "text-red-300 font-semibold" :
                  line.startsWith("▶") ? "text-blue-400 font-semibold mt-1" :
                  "text-green-400"
                }
              >
                {line || " "}
              </div>
            ))}
            {installing && <div className="animate-pulse text-green-400">▊</div>}
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={prevStep}>← Quay lại</Button>
        <Button onClick={nextStep} disabled={!allOk}>Tiếp theo →</Button>
      </div>
    </div>
  );
}
