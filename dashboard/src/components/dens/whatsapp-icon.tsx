import { WhatsappLogo, type IconProps } from "@phosphor-icons/react"

/*
 * Logo WhatsApp untuk tombol kirim WA (Nuara, bukan bagian dens-ui). lucide
 * tidak memuat logo merek, jadi ini satu-satunya ikon Phosphor (MIT) di UI
 * dens-ui; ukurannya ikut kelas `size-*` seperti ikon lucide.
 */
function WhatsAppIcon(props: IconProps) {
  return <WhatsappLogo aria-hidden {...props} />
}

export { WhatsAppIcon }
