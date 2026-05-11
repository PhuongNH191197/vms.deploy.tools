import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Zap, Server, Plus, Trash2, CheckCircle2, XCircle, Loader2,
  Package, Eye, EyeOff, ChevronDown, ChevronRight, RotateCcw,
} from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { testConnection, listProjects } from "@/lib/tauri/commands";
import { useServerStore } from "@/store/serverStore";
import { useBulkDeployStore } from "@/store/bulkDeployStore";
import { generateCombinedCompose } from "@/lib/composeGenerator";
import type { Project } from "@/types";
import { cn } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────────────────────

const NETWORK_RE = /^[a-z0-9][a-z0-9_-]*$/;

interface ServiceDef {
  name: string;
  displayName: string;
  defaultVersion: string;
}

const AVAILABLE_SERVICES: ServiceDef[] = [
  { name: "minio",         displayName: "MinIO",         defaultVersion: "RELEASE.2024-01-01T00-00-00Z" },
  { name: "rabbitmq",      displayName: "RabbitMQ",      defaultVersion: "3.12-management" },
  { name: "keycloak",      displayName: "Keycloak",      defaultVersion: "23.0" },
  { name: "redis",         displayName: "Redis",         defaultVersion: "7.2-alpine" },
  { name: "elasticsearch", displayName: "Elasticsearch", defaultVersion: "8.11.0" },
  { name: "grafana",       displayName: "Grafana",       defaultVersion: "latest" },
  { name: "prometheus",    displayName: "Prometheus",    defaultVersion: "latest" },
  { name: "custom-1",     displayName: "Custom 1",      defaultVersion: "latest" },
  { name: "custom-2",     displayName: "Custom 2",      defaultVersion: "latest" },
  { name: "custom-3",     displayName: "Custom 3",      defaultVersion: "latest" },
];

// ── Step indicator ────────────────────────────────────────────────────────────

function StepDot({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black transition-all",
        done  ? "bg-df-green text-df-bg-deep" :
        active ? "bg-df-cyan text-df-bg-deep" :
                 "bg-white/10 text-white/30"
      )}>
        {done ? <CheckCircle2 size={14} /> : n}
      </div>
      <span className={cn(
        "text-[11px] font-black uppercase tracking-widest transition-colors",
        active ? "text-white" : done ? "text-df-green" : "text-white/30"
      )}>{label}</span>
    </div>
  );
}

function StepIndicator({ step }: { step: number }) {
  const line = "flex-1 h-px bg-white/[0.08] mx-2";
  return (
    <div className="flex items-center mb-8">
      <StepDot n={1} label="Servers" active={step === 1} done={step > 1} />
      <div className={line} />
      <StepDot n={2} label="Stack Config" active={step === 2} done={step > 2} />
      <div className={line} />
      <StepDot n={3} label="Execute" active={step === 3} done={step > 3} />
    </div>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────

function Section({ title, badge, children }: { title: string; badge?: string | number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="glass-card rounded-2xl border border-white/[0.06] overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.025] transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-black uppercase tracking-widest text-white/70">{title}</span>
          {badge !== undefined && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded bg-df-cyan/10 text-df-cyan border border-df-cyan/20">
              {badge}
            </span>
          )}
        </div>
        {open ? <ChevronDown size={14} className="text-white/30" /> : <ChevronRight size={14} className="text-white/30" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-white/[0.05]">{children}</div>}
    </div>
  );
}

// ── Step 1: Server Selection ──────────────────────────────────────────────────

function Step1({ onNext }: { onNext: () => void }) {
  const { servers, fetchServers } = useServerStore();
  const {
    selectedServerIds, toggleServer, setAllServers,
    credential, setCredential,
    authType, setAuthType,
    environment, setEnvironment,
    rootPath, setRootPath,
  } = useBulkDeployStore();

  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showPass, setShowPass] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [envFilter, setEnvFilter] = useState("all");

  useEffect(() => { fetchServers(); listProjects().then(setProjects).catch(() => {}); }, []);

  // Pre-select servers from project query param
  useEffect(() => {
    const pid = searchParams.get("project");
    if (pid && servers.length > 0) {
      const ids = servers.filter((s) => s.project_id === pid).map((s) => s.id);
      if (ids.length > 0) setAllServers(ids);
    }
  }, [servers, searchParams]);

  const filtered = envFilter === "all" ? servers : servers.filter((s) => s.group_name === envFilter);
  const envGroups = [...new Set(servers.map((s) => s.group_name))];

  const handleTestFirst = async () => {
    if (selectedServerIds.length === 0 || !credential) return;
    const server = servers.find((s) => s.id === selectedServerIds[0]);
    if (!server) return;
    setTesting(true); setTestResult(null);
    try {
      const msg = await testConnection({ host: server.host, port: server.port, username: server.username, authType, credential });
      setTestResult({ ok: true, msg: msg || "Connected" });
    } catch (e) {
      setTestResult({ ok: false, msg: String(e) });
    } finally { setTesting(false); }
  };

  const canNext = selectedServerIds.length > 0 && credential.trim().length > 0;

  return (
    <div className="space-y-5">
      {/* Server list */}
      <div className="glass-card rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="px-5 pt-5 pb-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-widest text-white/70">Select Servers</span>
            {selectedServerIds.length > 0 && (
              <span className="ml-3 text-[9px] font-black px-2 py-0.5 rounded bg-df-cyan/10 text-df-cyan border border-df-cyan/20">
                {selectedServerIds.length} selected
              </span>
            )}
          </div>
          {/* ENV filter pills */}
          <div className="flex items-center gap-1.5">
            {["all", ...envGroups].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setEnvFilter(g)}
                className={cn(
                  "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg transition-colors",
                  envFilter === g ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
                )}
              >{g}</button>
            ))}
          </div>
        </div>

        <div className="border-t border-white/[0.05] divide-y divide-white/[0.04]">
          {filtered.length === 0 && (
            <div className="flex items-center justify-center py-10 gap-3">
              <Server size={16} className="text-white/20" />
              <span className="text-[11px] text-white/25 font-black uppercase tracking-widest">Không có server</span>
            </div>
          )}
          {filtered.map((s) => {
            const sel = selectedServerIds.includes(s.id);
            const proj = projects.find((p) => p.id === s.project_id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleServer(s.id)}
                className={cn(
                  "w-full flex items-center gap-4 px-5 py-3 text-left transition-colors",
                  sel ? "bg-df-cyan/[0.06]" : "hover:bg-white/[0.025]"
                )}
              >
                {/* Checkbox */}
                <div className={cn(
                  "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                  sel ? "bg-df-cyan border-df-cyan" : "border-white/20"
                )}>
                  {sel && <CheckCircle2 size={10} className="text-df-bg-deep" />}
                </div>
                <Server size={15} className={sel ? "text-df-cyan" : "text-white/25"} />
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-black text-white">{s.name}</span>
                  <span className="text-[11px] text-white/40 font-mono ml-3">{s.host}:{s.port}</span>
                </div>
                {proj && (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded" style={{ background: `${proj.color}15`, color: proj.color, border: `1px solid ${proj.color}30` }}>
                    {proj.name}
                  </span>
                )}
                <span className={cn(
                  "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border",
                  s.group_name === "production" ? "bg-df-red/10 text-df-red border-df-red/20" :
                  s.group_name === "staging"    ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                                  "bg-df-cyan/10 text-df-cyan border-df-cyan/20"
                )}>{s.group_name}</span>
              </button>
            );
          })}
        </div>

        {/* Select all / none */}
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-white/[0.05] flex gap-3">
            <button type="button" onClick={() => setAllServers(filtered.map((s) => s.id))}
              className="text-[10px] font-bold text-df-cyan/70 hover:text-df-cyan transition-colors">
              Select all
            </button>
            <button type="button" onClick={() => setAllServers([])}
              className="text-[10px] font-bold text-white/30 hover:text-white/60 transition-colors">
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Credential + config */}
      <div className="glass-card rounded-2xl border border-white/[0.06] p-5 space-y-5">
        <span className="text-[11px] font-black uppercase tracking-widest text-white/70 block">Credentials & Config</span>

        {/* Auth type */}
        <div className="flex gap-4">
          {(["password", "key"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setAuthType(t)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all",
                authType === t
                  ? "bg-df-cyan/10 border-df-cyan/40 text-df-cyan"
                  : "border-white/10 text-white/30 hover:border-white/20 hover:text-white/50"
              )}
            >
              {t === "password" ? "Password" : "SSH Key"}
            </button>
          ))}
        </div>

        {/* Credential input */}
        <div>
          <Label className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-2 block">
            {authType === "password" ? "Password" : "Private Key Path / Content"}
          </Label>
          <div className="relative">
            <Input
              type={showPass ? "text" : "password"}
              className="input-glass rounded-xl h-11 pr-10"
              placeholder={authType === "password" ? "Server password" : "~/.ssh/id_rsa or key content"}
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              onClick={() => setShowPass((v) => !v)}
            >
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* Environment + root path */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-2 block">Environment</Label>
            <div className="flex gap-2">
              {(["lab", "production"] as const).map((e) => (
                <button key={e} type="button" onClick={() => setEnvironment(e)}
                  className={cn(
                    "flex-1 py-2 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all",
                    environment === e
                      ? e === "production"
                        ? "bg-df-red/10 border-df-red/40 text-df-red"
                        : "bg-df-cyan/10 border-df-cyan/40 text-df-cyan"
                      : "border-white/10 text-white/30 hover:border-white/20"
                  )}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-2 block">Root Path</Label>
            <Input
              className="input-glass rounded-xl h-11"
              value={rootPath}
              onChange={(e) => setRootPath(e.target.value)}
              placeholder="/opt/vms"
            />
          </div>
        </div>

        {/* Test connection */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleTestFirst}
            disabled={testing || selectedServerIds.length === 0 || !credential}
            className="btn-cyan rounded-xl px-5 h-9 text-[11px] font-black uppercase tracking-widest gap-2"
          >
            {testing ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
            Test First Server
          </Button>
          {testResult && (
            <span className={cn("text-[11px] font-bold flex items-center gap-1.5",
              testResult.ok ? "text-df-green" : "text-df-red")}>
              {testResult.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
              {testResult.msg}
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={onNext}
          disabled={!canNext}
          className="btn-cyan rounded-xl px-8 h-12 font-black uppercase tracking-widest text-[11px] gap-2"
        >
          Configure Stack →
        </Button>
      </div>
    </div>
  );
}

// ── Step 2: Stack Config ──────────────────────────────────────────────────────

function Step2({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const {
    dockerNetworks, setDockerNetworks,
    selectedExternals, addExternal, removeExternal, updateExternal,
    envVars, addEnvVar, updateEnvVar, removeEnvVar,
    apps, addApp, removeApp, updateApp,
  } = useBulkDeployStore();

  const [netInput, setNetInput] = useState("");
  const [configuringExt, setConfiguringExt] = useState<string | null>(null);
  const [activeEnvTab, setActiveEnvTab] = useState<string>("");

  useEffect(() => {
    if (selectedExternals.length > 0 && !activeEnvTab) {
      setActiveEnvTab(selectedExternals[0].name);
    }
  }, [selectedExternals]);

  const addNetwork = () => {
    const v = netInput.trim().toLowerCase();
    if (!v || !NETWORK_RE.test(v) || dockerNetworks.includes(v)) return;
    setDockerNetworks([...dockerNetworks, v]);
    setNetInput("");
  };

  const isExtSelected = (name: string) => selectedExternals.some((x) => x.name === name);

  const toggleExt = (svc: ServiceDef) => {
    if (isExtSelected(svc.name)) {
      removeExternal(svc.name);
      if (configuringExt === svc.name) setConfiguringExt(null);
    } else {
      addExternal({ name: svc.name, displayName: svc.displayName, source: "online", version: svc.defaultVersion, tarPath: "", composeFolderPath: "" });
      setConfiguringExt(svc.name);
    }
  };

  const configSvc = selectedExternals.find((x) => x.name === configuringExt);

  return (
    <div className="space-y-4">
      {/* Networks */}
      <Section title="Docker Networks" badge={dockerNetworks.length}>
        <div className="pt-4 space-y-3">
          <div className="flex gap-2">
            <Input
              className="input-glass rounded-xl h-10 flex-1"
              placeholder="network-name (lowercase, a-z0-9_-)"
              value={netInput}
              onChange={(e) => setNetInput(e.target.value.toLowerCase())}
              onKeyDown={(e) => e.key === "Enter" && addNetwork()}
            />
            <Button onClick={addNetwork} className="btn-cyan rounded-xl px-4 h-10 font-black text-[11px] gap-1">
              <Plus size={14} /> Add
            </Button>
          </div>
          {dockerNetworks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {dockerNetworks.map((n) => (
                <div key={n} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                  <span className="text-[11px] font-mono text-df-cyan">{n}</span>
                  <button type="button" onClick={() => setDockerNetworks(dockerNetworks.filter((x) => x !== n))}
                    className="text-white/25 hover:text-df-red transition-colors">
                    <XCircle size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* External Services */}
      <Section title="External Services" badge={selectedExternals.length}>
        <div className="pt-4 space-y-4">
          <div className="grid grid-cols-5 gap-2">
            {AVAILABLE_SERVICES.map((svc) => {
              const sel = isExtSelected(svc.name);
              return (
                <button
                  key={svc.name}
                  type="button"
                  onClick={() => toggleExt(svc)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center",
                    sel
                      ? "bg-df-cyan/10 border-df-cyan/30 text-df-cyan"
                      : "border-white/[0.06] text-white/40 hover:border-white/20 hover:text-white/70"
                  )}
                >
                  <Package size={16} />
                  <span className="text-[9px] font-black uppercase tracking-wide">{svc.displayName}</span>
                </button>
              );
            })}
          </div>

          {/* Config panel for selected service */}
          {selectedExternals.length > 0 && (
            <div className="space-y-2">
              <div className="flex gap-2 flex-wrap">
                {selectedExternals.map((s) => (
                  <button key={s.name} type="button" onClick={() => setConfiguringExt(s.name)}
                    className={cn(
                      "text-[10px] font-black px-3 py-1.5 rounded-lg border transition-colors",
                      configuringExt === s.name ? "bg-white/10 border-white/20 text-white" : "border-white/[0.06] text-white/40 hover:text-white/60"
                    )}>
                    {s.displayName}
                  </button>
                ))}
              </div>

              {configSvc && (
                <div className="rounded-xl border border-white/[0.06] p-4 space-y-3 bg-white/[0.02]">
                  <div className="flex gap-3">
                    {(["online", "offline"] as const).map((t) => (
                      <button key={t} type="button" onClick={() => updateExternal(configSvc.name, { source: t })}
                        className={cn(
                          "text-[10px] font-black px-3 py-1.5 rounded-lg border transition-colors",
                          configSvc.source === t ? "bg-df-cyan/10 border-df-cyan/30 text-df-cyan" : "border-white/[0.06] text-white/30"
                        )}>{t === "online" ? "Online Pull" : "Offline .tar"}</button>
                    ))}
                  </div>
                  {configSvc.source === "online" && (
                    <Input className="input-glass rounded-xl h-9 text-[12px]" placeholder="version/tag"
                      value={configSvc.version}
                      onChange={(e) => updateExternal(configSvc.name, { version: e.target.value })} />
                  )}
                  {configSvc.source === "offline" && (
                    <Input className="input-glass rounded-xl h-9 text-[12px]" placeholder="C:\images\service.tar"
                      value={configSvc.tarPath}
                      onChange={(e) => updateExternal(configSvc.name, { tarPath: e.target.value })} />
                  )}
                  <Input className="input-glass rounded-xl h-9 text-[12px]" placeholder="C:\configs\service (compose folder)"
                    value={configSvc.composeFolderPath}
                    onChange={(e) => updateExternal(configSvc.name, { composeFolderPath: e.target.value })} />
                </div>
              )}
            </div>
          )}
        </div>
      </Section>

      {/* Env Variables */}
      <Section title="Environment Variables" badge={Object.values(envVars).flat().length}>
        <div className="pt-4 space-y-3">
          {selectedExternals.length === 0 && (
            <p className="text-[11px] text-white/25 font-bold">Thêm External Services để cấu hình env vars.</p>
          )}
          {selectedExternals.length > 0 && (
            <>
              <div className="flex gap-2 flex-wrap">
                {selectedExternals.map((svc) => (
                  <button key={svc.name} type="button" onClick={() => setActiveEnvTab(svc.name)}
                    className={cn(
                      "text-[10px] font-black px-3 py-1.5 rounded-lg border transition-colors",
                      activeEnvTab === svc.name ? "bg-white/10 border-white/20 text-white" : "border-white/[0.06] text-white/30 hover:text-white/50"
                    )}>
                    {svc.displayName}
                    {(envVars[svc.name]?.length ?? 0) > 0 && (
                      <span className="ml-1.5 text-df-cyan">{envVars[svc.name].length}</span>
                    )}
                  </button>
                ))}
              </div>

              {activeEnvTab && (
                <div className="space-y-2">
                  {(envVars[activeEnvTab] ?? []).map((v, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input className="input-glass rounded-xl h-9 text-[12px] flex-1 font-mono" placeholder="KEY"
                        value={v.key} onChange={(e) => updateEnvVar(activeEnvTab, idx, { key: e.target.value })} />
                      <span className="text-white/20 text-sm">=</span>
                      <Input className="input-glass rounded-xl h-9 text-[12px] flex-1 font-mono" placeholder="value"
                        value={v.value} onChange={(e) => updateEnvVar(activeEnvTab, idx, { value: e.target.value })} />
                      <button type="button" onClick={() => removeEnvVar(activeEnvTab, idx)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white/20 hover:text-df-red hover:bg-df-red/10 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <Button onClick={() => addEnvVar(activeEnvTab)}
                    className="w-full h-9 rounded-xl border border-dashed border-white/10 bg-transparent text-white/30 hover:text-white/60 hover:border-white/20 text-[10px] font-black uppercase tracking-widest gap-1">
                    <Plus size={12} /> Add Variable
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Section>

      {/* App Modules */}
      <Section title="Application Modules" badge={apps.length}>
        <div className="pt-4 space-y-3">
          {apps.map((app, idx) => (
            <div key={app.id} className="rounded-xl border border-white/[0.06] p-4 space-y-3 bg-white/[0.02]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">App {idx + 1}</span>
                <button type="button" onClick={() => removeApp(app.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/20 hover:text-df-red hover:bg-df-red/10 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
              <Input className="input-glass rounded-xl h-9 text-[12px]" placeholder="App name"
                value={app.name} onChange={(e) => updateApp(app.id, { name: e.target.value })} />
              <div className="flex gap-2">
                {(["online", "offline", "git"] as const).map((src) => (
                  <button key={src} type="button" onClick={() => updateApp(app.id, { source: src })}
                    className={cn(
                      "text-[9px] font-black px-2.5 py-1.5 rounded-lg border transition-colors",
                      app.source === src ? "bg-df-cyan/10 border-df-cyan/30 text-df-cyan" : "border-white/[0.06] text-white/25"
                    )}>{src}</button>
                ))}
              </div>
              {app.source === "online" && (
                <div className="flex gap-2">
                  <Input className="input-glass rounded-xl h-9 text-[12px] flex-1" placeholder="registry/image"
                    value={app.image} onChange={(e) => updateApp(app.id, { image: e.target.value })} />
                  <Input className="input-glass rounded-xl h-9 text-[12px] w-28" placeholder="tag"
                    value={app.version} onChange={(e) => updateApp(app.id, { version: e.target.value })} />
                </div>
              )}
              {app.source === "offline" && (
                <Input className="input-glass rounded-xl h-9 text-[12px]" placeholder="/remote/path/image.tar (on server)"
                  value={app.tarServerPath} onChange={(e) => updateApp(app.id, { tarServerPath: e.target.value })} />
              )}
              {app.source === "git" && (
                <div className="space-y-2">
                  <Input className="input-glass rounded-xl h-9 text-[12px]" placeholder="https://github.com/org/repo"
                    value={app.gitUrl} onChange={(e) => updateApp(app.id, { gitUrl: e.target.value })} />
                  <div className="flex gap-2">
                    <Input className="input-glass rounded-xl h-9 text-[12px] flex-1" placeholder="branch (main)"
                      value={app.gitBranch} onChange={(e) => updateApp(app.id, { gitBranch: e.target.value })} />
                    <Input className="input-glass rounded-xl h-9 text-[12px] flex-1" type="password" placeholder="token (optional)"
                      value={app.gitToken} onChange={(e) => updateApp(app.id, { gitToken: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
          ))}
          <Button onClick={addApp}
            className="w-full h-10 rounded-xl border border-dashed border-white/10 bg-transparent text-white/30 hover:text-white/60 hover:border-white/20 text-[10px] font-black uppercase tracking-widest gap-2">
            <Plus size={13} /> Add App Module
          </Button>
        </div>
      </Section>

      <div className="flex justify-between pt-2">
        <Button onClick={onBack} variant="ghost" className="btn-ghost-glass rounded-xl px-6 h-12 font-black uppercase tracking-widest text-[11px]">
          ← Back
        </Button>
        <Button onClick={onNext} className="btn-cyan rounded-xl px-8 h-12 font-black uppercase tracking-widest text-[11px] gap-2">
          Review & Deploy →
        </Button>
      </div>
    </div>
  );
}

// ── Step 3: Execute ───────────────────────────────────────────────────────────

interface DeployEvent { step_id: string; line: string; done: boolean; error: boolean; }

function Step3({ onBack }: { onBack: () => void }) {
  const { servers } = useServerStore();
  const {
    selectedServerIds, credential, rootPath,
    dockerNetworks, selectedExternals, envVars, apps,
    serverProgress, initProgress, setProgress, appendLog,
    reset,
  } = useBulkDeployStore();

  const [deploying, setDeploying] = useState(false);
  const [done, setDone] = useState(false);
  const [activeLog, setActiveLog] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [activeLog && serverProgress[activeLog]?.logs.length]);

  const buildEnvContent = () => {
    const lines = ["# vms.env — generated by BulkDeploy"];
    for (const svc of selectedExternals) {
      const vars = envVars[svc.name] ?? [];
      if (vars.length === 0) continue;
      lines.push(`\n# ${svc.displayName}`);
      vars.forEach((v) => { if (v.key.trim()) lines.push(`${v.key}=${v.value}`); });
    }
    return lines.join("\n");
  };

  const deployToServer = async (serverId: string) => {
    const server = servers.find((s) => s.id === serverId);
    if (!server) return;

    const EVENT_ID = `bulk-${serverId}-${Date.now()}`;
    const log = (line: string) => appendLog(serverId, line);
    const pct = (n: number) => setProgress(serverId, { pct: n });

    setProgress(serverId, { status: "running", pct: 0 });
    setActiveLog(serverId);

    const unlisteners: Array<() => void> = [];

    try {
      // Listen to streaming events
      const unlisten = await listen<DeployEvent>(EVENT_ID, (ev) => {
        const { line, error } = ev.payload;
        if (line) log(error ? `[ERR] ${line}` : line);
      });
      unlisteners.push(unlisten);

      // 1. Create dirs
      log(`\n▶ [${server.name}] Creating directories...`);
      const appDirs = apps.map((a) => `${rootPath}/apps/${a.name.replace(/[^a-z0-9_-]/gi, "_").toLowerCase()}`);
      const extDirs = selectedExternals.map((e) => `${rootPath}/external/${e.name}`);
      const mkCmd = `mkdir -p ${rootPath} ${[...extDirs, ...appDirs].join(" ")}`;
      await invoke("run_deploy_step", {
        host: server.host, port: server.port, username: server.username,
        authType: server.auth_type, credential,
        commands: [mkCmd], eventId: EVENT_ID, stepId: "dirs",
      });
      pct(15);

      // 2. Write vms.env
      log(`\n▶ [${server.name}] Writing vms.env...`);
      await invoke("write_vms_env", {
        host: server.host, port: server.port, username: server.username,
        authType: server.auth_type, credential,
        rootPath, content: buildEnvContent(),
      });
      log(`✓ ${rootPath}/vms.env written`);
      pct(30);

      // 3. Docker networks
      if (dockerNetworks.length > 0) {
        log(`\n▶ [${server.name}] Creating docker networks...`);
        await invoke("create_docker_networks", {
          host: server.host, port: server.port, username: server.username,
          authType: server.auth_type, credential,
          networks: dockerNetworks,
        });
        pct(45);
      }

      // 4. External services
      if (selectedExternals.length > 0) {
        log(`\n▶ [${server.name}] Starting external services...`);

        for (const svc of selectedExternals) {
          const dir = `${rootPath}/external/${svc.name}`;
          if (svc.source === "offline" && svc.tarPath.trim()) {
            const tarName = svc.tarPath.split(/[\\/]/).pop() ?? `${svc.name}.tar`;
            log(`  ↑ Upload ${tarName}`);
            const extUnlisten = await listen<DeployEvent>(`${EVENT_ID}-tar-${svc.name}`, (ev) => {
              if (ev.payload.line) log(ev.payload.line);
            });
            unlisteners.push(extUnlisten);
            await invoke("upload_path", {
              host: server.host, port: server.port, username: server.username,
              authType: server.auth_type, credential,
              localPath: svc.tarPath, remotePath: `${dir}/${tarName}`,
              eventId: `${EVENT_ID}-tar-${svc.name}`,
            });
          }
          if (svc.composeFolderPath.trim()) {
            log(`  ↑ Upload compose/${svc.name}`);
            const compUnlisten = await listen<DeployEvent>(`${EVENT_ID}-compose-${svc.name}`, (ev) => {
              if (ev.payload.line) log(ev.payload.line);
            });
            unlisteners.push(compUnlisten);
            await invoke("upload_path", {
              host: server.host, port: server.port, username: server.username,
              authType: server.auth_type, credential,
              localPath: svc.composeFolderPath, remotePath: dir,
              eventId: `${EVENT_ID}-compose-${svc.name}`,
            });
          }
        }

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
          host: server.host, port: server.port, username: server.username,
          authType: server.auth_type, credential,
          commands: extCmds, eventId: EVENT_ID, stepId: "externals",
        });
        pct(65);
      }

      // 5. Apps
      if (apps.length > 0) {
        log(`\n▶ [${server.name}] Deploying apps...`);
        const composableApps = apps.filter((a) => a.source !== "git");
        if (composableApps.length > 0) {
          const composeContent = generateCombinedCompose(apps, dockerNetworks, rootPath);
          await invoke("write_remote_file", {
            host: server.host, port: server.port, username: server.username,
            authType: server.auth_type, credential,
            remotePath: `${rootPath}/docker-compose.yml`, content: composeContent,
          });
          log(`✓ docker-compose.yml written`);
        }

        const appCmds = apps.flatMap((app) => {
          const slug = app.name.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
          const dir = `${rootPath}/apps/${slug}`;
          const cmds: string[] = [];
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
        await invoke("run_deploy_step", {
          host: server.host, port: server.port, username: server.username,
          authType: server.auth_type, credential,
          commands: appCmds, eventId: EVENT_ID, stepId: "apps",
        });
        pct(85);
      }

      // 6. Healthcheck
      log(`\n▶ [${server.name}] Healthcheck...`);
      await invoke("run_deploy_step", {
        host: server.host, port: server.port, username: server.username,
        authType: server.auth_type, credential,
        commands: [`docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}" 2>&1`],
        eventId: EVENT_ID, stepId: "healthcheck",
      });
      pct(100);

      // Save record
      await invoke("save_deploy_record", {
        serverId: server.id,
        moduleName: apps.map((a) => a.name).join(",") || "externals-only",
        moduleVersion: "latest", action: "install", status: "success",
        composeBackup: "", imageTag: "latest",
      }).catch(() => {});

      log(`\n✅ [${server.name}] Deploy complete!`);
      setProgress(serverId, { status: "done", pct: 100 });
    } catch (e) {
      log(`\n❌ [${server.name}] Failed: ${e}`);
      setProgress(serverId, { status: "failed" });
    } finally {
      unlisteners.forEach((u) => u());
    }
  };

  const handleDeploy = async () => {
    if (deploying) return;
    setDeploying(true);
    setDone(false);
    initProgress(selectedServerIds);

    for (const id of selectedServerIds) {
      await deployToServer(id);
    }

    setDeploying(false);
    setDone(true);
  };

  const selectedServers = selectedServerIds.map((id) => servers.find((s) => s.id === id)).filter(Boolean);

  return (
    <div className="space-y-5">
      {/* Server progress panels */}
      <div className="space-y-3">
        {selectedServers.map((server) => {
          if (!server) return null;
          const prog = serverProgress[server.id];
          const status = prog?.status ?? "pending";
          const pct = prog?.pct ?? 0;
          const isActive = activeLog === server.id;

          return (
            <div
              key={server.id}
              className={cn(
                "glass-card rounded-2xl border overflow-hidden cursor-pointer transition-all",
                isActive ? "border-df-cyan/30" : "border-white/[0.06]",
              )}
              onClick={() => setActiveLog(isActive ? null : server.id)}
            >
              <div className="flex items-center gap-4 px-5 py-4">
                <div className={cn("w-2 h-2 rounded-full flex-shrink-0",
                  status === "done"    ? "bg-df-green shadow-[0_0_8px_rgba(74,222,128,0.9)]" :
                  status === "running" ? "bg-df-cyan animate-pulse shadow-[0_0_8px_rgba(49,232,255,0.9)]" :
                  status === "failed"  ? "bg-df-red shadow-[0_0_8px_rgba(248,113,113,0.9)]" :
                                         "bg-white/20"
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[13px] font-black text-white">{server.name}</span>
                    <span className="text-[10px] text-white/35 font-mono">{server.host}</span>
                  </div>
                  <div className="h-[5px] w-full rounded-full bg-black/50 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: status === "failed" ? "#ef4444" :
                                    status === "done"   ? "#4ade80" :
                                                          "linear-gradient(90deg, #31E8FF, #AD00FF)",
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={cn("text-[10px] font-black",
                    status === "done"    ? "text-df-green" :
                    status === "running" ? "text-df-cyan" :
                    status === "failed"  ? "text-df-red" :
                                           "text-white/25"
                  )}>
                    {status === "running" ? `${pct}%` :
                     status === "done"    ? "Done" :
                     status === "failed"  ? "Failed" : "Waiting"}
                  </span>
                  {status === "running" && <Loader2 size={13} className="animate-spin text-df-cyan" />}
                  {status === "done"    && <CheckCircle2 size={13} className="text-df-green" />}
                  {status === "failed"  && <XCircle size={13} className="text-df-red" />}
                </div>
              </div>

              {/* Log panel (expanded) */}
              {isActive && (prog?.logs.length ?? 0) > 0 && (
                <div
                  ref={logRef}
                  className="border-t border-white/[0.06] h-44 overflow-y-auto bg-[#050810] p-4 font-mono text-[11px] text-green-400 space-y-px"
                >
                  {prog?.logs.map((line, i) => (
                    <div key={i} className={
                      line.startsWith("[ERR]") || line.startsWith("❌") ? "text-red-400" :
                      line.startsWith("✓") || line.startsWith("✅")    ? "text-green-400" :
                      line.startsWith("▶")  ? "text-df-cyan font-bold" :
                      line.startsWith("  ↑") ? "text-amber-400" : ""
                    }>{line || " "}</div>
                  ))}
                  {status === "running" && <div className="animate-pulse text-df-cyan">▊</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {done && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-df-green/10 border border-df-green/20">
          <CheckCircle2 size={18} className="text-df-green" />
          <span className="text-[13px] font-black text-df-green">
            Bulk deploy complete — {selectedServerIds.filter((id) => serverProgress[id]?.status === "done").length}/{selectedServerIds.length} servers succeeded.
          </span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button onClick={onBack} disabled={deploying} variant="ghost"
          className="btn-ghost-glass rounded-xl px-6 h-12 font-black uppercase tracking-widest text-[11px]">
          ← Back
        </Button>
        <div className="flex gap-3">
          {done && (
            <Button onClick={reset} variant="ghost"
              className="btn-ghost-glass rounded-xl px-6 h-12 font-black uppercase tracking-widest text-[11px] gap-2">
              <RotateCcw size={14} /> New Deploy
            </Button>
          )}
          <Button
            onClick={handleDeploy}
            disabled={deploying || selectedServerIds.length === 0}
            className="btn-cyan rounded-xl px-8 h-12 font-black uppercase tracking-widest text-[11px] gap-2"
          >
            {deploying
              ? <><Loader2 size={14} className="animate-spin" /> Deploying {selectedServerIds.length} servers...</>
              : <><Zap size={14} /> Deploy to {selectedServerIds.length} server{selectedServerIds.length !== 1 ? "s" : ""}</>
            }
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main BulkDeploy page ──────────────────────────────────────────────────────

export default function BulkDeploy() {
  const { currentStep, setCurrentStep } = useBulkDeployStore();

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, rgba(34,211,238,0.15), rgba(34,211,238,0.05))", border: "1px solid rgba(34,211,238,0.2)" }}>
          <Zap size={22} className="text-[#22D3EE]" />
        </div>
        <div>
          <h1 className="text-[22px] font-black text-white tracking-tight">Bulk Deploy</h1>
          <p className="text-[11px] text-df-text-secondary font-bold uppercase tracking-widest opacity-60">
            Deploy stack to multiple servers at once
          </p>
        </div>
      </div>

      <StepIndicator step={currentStep} />

      {currentStep === 1 && (
        <Step1 onNext={() => setCurrentStep(2)} />
      )}
      {currentStep === 2 && (
        <Step2 onNext={() => setCurrentStep(3)} onBack={() => setCurrentStep(1)} />
      )}
      {currentStep === 3 && (
        <Step3 onBack={() => setCurrentStep(2)} />
      )}
    </div>
  );
}
