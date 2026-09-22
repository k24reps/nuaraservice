const WA_NUMBER = "6282118218747";
const GREETING = "Halo Nuara Service, saya mau konsultasi kerusakan perangkat";

const form = document.getElementById("nota");
const preview = document.getElementById("preview");
const groups = [...form.querySelectorAll(".keluhan")];
const other = document.getElementById("lainnya");

function selectedDevice() {
  return form.querySelector('input[name="perangkat"]:checked').value;
}

function activeGroup() {
  return groups.find((g) => g.dataset.device === selectedDevice());
}

function checkedComplaints() {
  return [...activeGroup().querySelectorAll("input:checked")].map((i) => i.value);
}

function composeMessage() {
  const lines = [GREETING + ".", "", "Perangkat: " + selectedDevice()];
  const complaints = checkedComplaints();
  if (complaints.length) lines.push("Keluhan: " + complaints.join(", "));
  const extra = other.value.trim();
  if (extra) lines.push("Keluhan lain: " + extra);
  return lines.join("\n");
}

function render() {
  const device = selectedDevice();
  groups.forEach((g) => { g.hidden = g.dataset.device !== device; });

  const parts = [device, ...checkedComplaints()];
  const extra = other.value.trim();
  if (extra) parts.push(extra);
  preview.textContent = "Akan terkirim: " + parts.join(", ");
}

form.addEventListener("change", render);
other.addEventListener("input", render);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const url = "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(composeMessage());
  const opened = window.open(url, "_blank");
  if (opened) opened.opener = null;
  else window.location.href = url;
});

render();

const stamp = document.getElementById("stamp");
const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (stamp && "IntersectionObserver" in window && !calm) {
  const box = stamp.getBoundingClientRect();
  if (box.top > window.innerHeight) {
    stamp.classList.add("is-pending");
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        stamp.classList.remove("is-pending");
        io.disconnect();
      }
    }, { threshold: 0.6 });
    io.observe(stamp);
  }
}
