import { Toaster as Sonner, type ToasterProps } from "sonner"

/* Toast sonner bertema Nuara. Belum dipasang di aplikasi: sistem toast
   FixMaster (components/ui/ToastContainer) tetap dipakai sampai L-47
   memutuskan penggantinya. DBD: muncul 4 detik, bisa ditutup, aria-live. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      duration={4000}
      closeButton
      containerAriaLabel="Notifikasi"
      toastOptions={{
        classNames: {
          toast:
            "!rounded-2xl !border-0 !bg-card !text-card-foreground !shadow-raised !ring-1 !ring-border/60 !font-sans",
          description: "!text-muted-foreground",
          success: "[&_[data-icon]]:!text-success-foreground",
          error: "[&_[data-icon]]:!text-destructive",
          closeButton: "!border-border !bg-card !text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
export { toast } from "sonner"
