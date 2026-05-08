import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle, Server } from "lucide-react";
import { useServerStore } from "@/store/serverStore";
import { testConnection } from "@/lib/tauri/commands";
import type { AddServerPayload, AuthType } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TestStatus = "idle" | "testing" | "ok" | "error";

export default function AddServerDialog({ open, onOpenChange }: Props) {
  const addServer = useServerStore((s) => s.addServer);

  const [form, setForm] = useState<AddServerPayload>({
    name: "",
    host: "",
    port: 22,
    username: "root",
    auth_type: "password",
    credential: "",
    group_name: "lab",
  });

  const [showCredential, setShowCredential] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testMsg, setTestMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (field: Partial<AddServerPayload>) =>
    setForm((prev) => ({ ...prev, ...field }));

  const handleTest = async () => {
    setTestStatus("testing");
    setTestMsg("");
    try {
      await testConnection({
        host: form.host,
        port: form.port,
        username: form.username,
        authType: form.auth_type,
        credential: form.credential,
      });
      setTestStatus("ok");
      setTestMsg("Connection successful");
    } catch (e) {
      setTestStatus("error");
      setTestMsg(String(e));
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.host || !form.username || !form.credential) {
      setError("Vui lòng điền đầy đủ thông tin.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await addServer(form);
      onOpenChange(false);
      resetForm();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setForm({ name: "", host: "", port: 22, username: "root", auth_type: "password", credential: "", group_name: "lab" });
    setTestStatus("idle");
    setTestMsg("");
    setError("");
  };

  const labelClass = "text-[11px] font-black uppercase tracking-widest text-df-text-secondary mb-2 block";

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="glass-dialog sm:max-w-[480px] rounded-3xl border-white/10 p-8">
        <DialogHeader className="mb-6">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-xl bg-df-cyan/10 flex items-center justify-center shadow-neon-cyan">
                <Server size={20} className="text-df-cyan" />
             </div>
             <DialogTitle className="text-[18px] font-black text-white uppercase tracking-tight">Thêm Server Mới</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2 animate-fade-in-up">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className={labelClass}>Tên Hiển Thị</Label>
              <Input className="input-glass rounded-xl h-11" placeholder="Prod-01" value={form.name} onChange={(e) => set({ name: e.target.value })} />
            </div>
            <div>
              <Label className={labelClass}>Nhóm Server</Label>
              <Select value={form.group_name} onValueChange={(v) => set({ group_name: v })}>
                <SelectTrigger className="input-glass rounded-xl h-11 font-bold text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-dialog border-white/10 rounded-xl">
                  <SelectItem value="production" className="font-bold">Production</SelectItem>
                  <SelectItem value="staging" className="font-bold">Staging</SelectItem>
                  <SelectItem value="lab" className="font-bold">Lab</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Label className={labelClass}>Host / IP Address</Label>
              <Input className="input-glass rounded-xl h-11" placeholder="192.168.1.100" value={form.host} onChange={(e) => set({ host: e.target.value })} />
            </div>
            <div>
              <Label className={labelClass}>SSH Port</Label>
              <Input className="input-glass rounded-xl h-11" type="number" value={form.port} onChange={(e) => set({ port: Number(e.target.value) })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className={labelClass}>Username</Label>
              <Input className="input-glass rounded-xl h-11" value={form.username} onChange={(e) => set({ username: e.target.value })} />
            </div>
            <div>
              <Label className={labelClass}>Xác Thực</Label>
              <Select value={form.auth_type} onValueChange={(v) => set({ auth_type: v as AuthType, credential: "" })}>
                <SelectTrigger className="input-glass rounded-xl h-11 font-bold text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-dialog border-white/10 rounded-xl">
                  <SelectItem value="password" className="font-bold">Password</SelectItem>
                  <SelectItem value="key" className="font-bold">SSH Key Path</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className={labelClass}>{form.auth_type === "password" ? "SSH Password" : "SSH Private Key Path"}</Label>
            <div className="relative">
              <Input
                type={showCredential ? "text" : "password"}
                placeholder={form.auth_type === "password" ? "••••••••" : "/root/.ssh/id_rsa"}
                value={form.credential}
                onChange={(e) => set({ credential: e.target.value })}
                className="input-glass rounded-xl h-11 pr-12"
              />
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-df-text-secondary hover:text-df-cyan transition-colors"
                onClick={() => setShowCredential((v) => !v)}
                tabIndex={-1}
              >
                {showCredential ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Test Connection Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-white/[0.05]">
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              onClick={handleTest} 
              disabled={testStatus === "testing" || !form.host || !form.credential}
              className="btn-ghost-glass rounded-xl px-4 py-2 text-[11px] font-black uppercase tracking-widest h-9"
            >
              {testStatus === "testing" ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
              Test Link
            </Button>
            
            <div className="flex items-center gap-2">
              {testStatus === "ok" && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-df-green/10 text-df-green border border-df-green/20 animate-fade-in">
                   <CheckCircle2 size={14} />
                   <span className="text-[11px] font-bold uppercase tracking-widest">Success</span>
                </div>
              )}
              {testStatus === "error" && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-df-red/10 text-df-red border border-df-red/20 animate-fade-in">
                   <XCircle size={14} />
                   <span className="text-[11px] font-bold uppercase tracking-widest">Failed</span>
                </div>
              )}
            </div>
          </div>
          
          {testStatus === "error" && <p className="text-[11px] text-df-red font-bold uppercase tracking-tighter opacity-80 px-1 truncate">{testMsg}</p>}
          {error && <p className="text-[11px] text-df-red font-bold uppercase tracking-widest px-1">{error}</p>}
        </div>

        <DialogFooter className="mt-8 gap-3">
          <Button variant="ghost" className="btn-ghost-glass rounded-xl px-6 h-12" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={handleSave} disabled={saving} className="btn-cyan rounded-xl px-8 h-12 font-black uppercase tracking-widest">
            {saving ? <Loader2 size={16} className="mr-2 animate-spin text-df-bg-deep" /> : null}
            Lưu Cấu Hình
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
