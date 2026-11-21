@AGENTS.md

# Catatan khusus Claude Code

Berkas ini sengaja tidak memuat aturan. Sumber kebenaran folder ini adalah `AGENTS.md`
(diimpor di baris pertama), di bawah aturan repo induk `../CLAUDE.md`.

Impor `@AGENTS.md` dipakai karena Claude Code tidak selalu memuat `AGENTS.md` sendiri
(versi lama, sesi tanpa feature flag, atau plugin `agents-md` dimatikan). Simlink tidak dipakai:
di Windows ia butuh hak Admin, dan tool Edit/Write tidak menulis menembusnya.
