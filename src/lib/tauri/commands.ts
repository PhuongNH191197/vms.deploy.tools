import { invoke } from "@tauri-apps/api/core";

// All Tauri invoke() calls go here — typed wrappers only
// TODO: add typed command wrappers as Rust commands are implemented

export async function testConnection(host: string, port: number, username: string): Promise<string> {
  return invoke("test_connection", { host, port, username });
}
