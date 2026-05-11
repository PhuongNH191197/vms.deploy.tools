import { useEffect } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGitLabRunnerStore } from "@/store/gitlabRunnerStore";
import { useServerStore } from "@/store/serverStore";
import RunnerListToolbar from "@/components/gitlab/RunnerListToolbar";
import RunnerTable from "@/components/gitlab/RunnerTable";
import RunnerDetailPanel from "@/components/gitlab/RunnerDetailPanel";
import InstallWizard from "@/components/gitlab/wizard/InstallWizard";
import ApiSettingsModal from "@/components/gitlab/ApiSettingsModal";
import type { GitLabRunnerDto } from "@/lib/tauri/gitlabRunner";

export default function GitLabRunner() {
  const {
    runners, isLoadingList, listError,
    wizardOpen, selectedRunner,
    apiSettingsOpen,
    loadRunners, loadProjectNames, triggerAutoScan,
    closeWizard,
    openApiSettings, closeApiSettings,
    selectRunner, deleteRunner,
    autoRefresh, stopAutoRefresh,
  } = useGitLabRunnerStore();

  const { servers, fetchServers } = useServerStore();

  useEffect(() => {
    fetchServers();
    loadRunners();
    loadProjectNames();
  }, []);

  // Auto-scan on mount after servers loaded
  useEffect(() => {
    if (servers.length > 0) {
      triggerAutoScan(servers.map((s) => s.id));
    }
  }, [servers.length]);

  // Cleanup auto-refresh on unmount
  useEffect(() => {
    return () => { if (autoRefresh) stopAutoRefresh(); };
  }, []);

  const handleDeleteRunner = async (id: number) => {
    if (!confirm("Xóa runner này?\n\nSẽ unregister khỏi server VÀ xóa khỏi danh sách.")) return;
    try {
      const result = await deleteRunner(id);
      if (result && !result.unregistered_on_server && result.unregister_error) {
        alert(`Đã xóa khỏi danh sách.\nLưu ý: Không unregister được trên server: ${result.unregister_error}`);
      }
    } catch (e) {
      alert(`Lỗi: ${e}`);
    }
  };

  const handleWizardComplete = async () => {
    closeWizard();
    await loadRunners();
    await loadProjectNames();
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0f1e] text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div>
          <h1 className="text-xl font-semibold">GitLab Runner</h1>
          <p className="text-xs text-white/40 mt-0.5">
            Quản lý CI/CD runner trên các Linux server
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-white/20 text-white/70 hover:text-white hover:border-white/40"
          onClick={openApiSettings}
        >
          <Settings className="w-4 h-4 mr-1.5" />
          API Settings
        </Button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 overflow-hidden">
          <RunnerListToolbar />

          {listError && (
            <div className="mx-6 mt-3 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
              {listError}
            </div>
          )}

          <div className="flex-1 overflow-auto">
            <RunnerTable
              runners={runners}
              isLoading={isLoadingList}
              onSelectRunner={(r: GitLabRunnerDto) => selectRunner(r)}
              onDeleteRunner={handleDeleteRunner}
            />
          </div>
        </div>

        {/* Detail panel */}
        {selectedRunner && (
          <RunnerDetailPanel
            runner={selectedRunner}
            onClose={() => selectRunner(null)}
          />
        )}
      </div>

      {/* Wizard modal */}
      {wizardOpen && (
        <InstallWizard
          onComplete={handleWizardComplete}
          onCancel={closeWizard}
        />
      )}

      {/* API Settings modal */}
      {apiSettingsOpen && (
        <ApiSettingsModal
          open={apiSettingsOpen}
          onClose={closeApiSettings}
        />
      )}
    </div>
  );
}
