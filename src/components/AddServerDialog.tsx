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
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle } from "lucide-react";
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

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm Server</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-4 items-center gap-3">
            <Label className="text-right">Tên</Label>
            <Input className="col-span-3" placeholder="Prod-01" value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </div>

          <div className="grid grid-cols-4 items-center gap-3">
            <Label className="text-right">Host / IP</Label>
            <Input className="col-span-3" placeholder="192.168.1.100" value={form.host} onChange={(e) => set({ host: e.target.value })} />
          </div>

          <div className="grid grid-cols-4 items-center gap-3">
            <Label className="text-right">Port</Label>
            <Input className="col-span-3" type="number" value={form.port} onChange={(e) => set({ port: Number(e.target.value) })} />
          </div>

          <div className="grid grid-cols-4 items-center gap-3">
            <Label className="text-right">Username</Label>
            <Input className="col-span-3" value={form.username} onChange={(e) => set({ username: e.target.value })} />
          </div>

          <div className="grid grid-cols-4 items-center gap-3">
            <Label className="text-right">Auth</Label>
            <Select value={form.auth_type} onValueChange={(v) => set({ auth_type: v as AuthType, credential: "" })}>
              <SelectTrigger className="col-span-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="password">Password</SelectItem>
                <SelectItem value="key">SSH Key (path)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-3">
            <Label className="text-right">{form.auth_type === "password" ? "Password" : "Key Path"}</Label>
            <div className="col-span-3 relative">
              <Input
                type={showCredential ? "text" : "password"}
                placeholder={form.auth_type === "password" ? "••••••••" : "/path/to/key.pem"}
                value={form.credential}
                onChange={(e) => set({ credential: e.target.value })}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowCredential((v) => !v)}
                tabIndex={-1}
              >
                {showCredential ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-3">
            <Label className="text-right">Nhóm</Label>
            <Select value={form.group_name} onValueChange={(v) => set({ group_name: v })}>
              <SelectTrigger className="col-span-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="lab">Lab</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-3 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={handleTest} disabled={testStatus === "testing" || !form.host || !form.credential}>
              {testStatus === "testing" ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
              Test Connection
            </Button>
            {testStatus === "ok" && <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle2 size={12} />{testMsg}</Badge>}
            {testStatus === "error" && <Badge variant="destructive" className="gap-1"><XCircle size={12} />Thất bại</Badge>}
          </div>
          {testStatus === "error" && <p className="text-xs text-destructive px-1">{testMsg}</p>}
          {error && <p className="text-xs text-destructive px-1">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
            Lưu Server
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
