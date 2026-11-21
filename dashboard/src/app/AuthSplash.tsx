/** Layar tunggu saat sesi dan data toko dimuat (AuthGate, WorkspaceGate). */
export function AuthSplash() {
  return (
    <div data-nu className="fixed inset-0 flex flex-col items-center justify-center gap-6">
      <img
        src="/logo-mark.png"
        alt="Nuara Service"
        width="64"
        height="64"
        className="size-16 rounded-2xl shadow-panel ring-1 ring-border/60"
      />
      <span
        role="status"
        aria-label="Memuat"
        className="size-7 animate-spin rounded-full border-[3px] border-border border-t-primary"
      />
    </div>
  );
}
