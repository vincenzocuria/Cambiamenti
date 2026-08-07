import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** Token Management API: env, file, oppure Credential Manager (Supabase CLI). */
export function getSupabaseAccessToken() {
  const fromEnv = process.env.SUPABASE_ACCESS_TOKEN?.trim()
  if (fromEnv) return fromEnv

  const candidates = [
    path.join(os.homedir(), '.supabase', 'access-token'),
    path.join(process.env.APPDATA || '', 'supabase', 'access-token'),
  ]
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const token = fs.readFileSync(file, 'utf8').trim()
        if (token) return token
      }
    } catch {
      /* ignore */
    }
  }

  if (process.platform === 'win32') {
    const ps = `
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices; using System.Text;
public class CredReadUtf8 {
  [DllImport("advapi32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credentialPtr);
  [DllImport("advapi32.dll", SetLastError=true)] public static extern bool CredFree(IntPtr cred);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct CREDENTIAL {
    public int Flags; public int Type; public string TargetName; public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public int CredentialBlobSize; public IntPtr CredentialBlob; public int Persist;
    public int AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName;
  }
  public static string Read(string target) {
    IntPtr ptr; if (!CredRead(target, 1, 0, out ptr)) return "";
    try {
      var c = (CREDENTIAL)Marshal.PtrToStructure(ptr, typeof(CREDENTIAL));
      if (c.CredentialBlob == IntPtr.Zero || c.CredentialBlobSize <= 0) return "";
      byte[] b = new byte[c.CredentialBlobSize];
      Marshal.Copy(c.CredentialBlob, b, 0, c.CredentialBlobSize);
      return Encoding.UTF8.GetString(b).TrimEnd('\\0').Trim();
    } finally { CredFree(ptr); }
  }
}
"@
Write-Output ([CredReadUtf8]::Read('Supabase CLI:supabase'))
`.trim()
    try {
      const token = execFileSync(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
        { encoding: 'utf8' },
      ).trim()
      if (token) return token
    } catch {
      /* ignore */
    }
  }

  return null
}
