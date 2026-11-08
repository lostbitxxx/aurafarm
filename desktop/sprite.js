const canvas = document.getElementById("sprite");
const caption = document.getElementById("caption");
const context = canvas.getContext("2d");

function drawSlime() {
  context.fillStyle = "rgba(8, 16, 12, 0.28)";
  context.beginPath();
  context.ellipse(64, 108, 36, 8, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#c6ef4a";
  context.beginPath();
  context.ellipse(64, 68, 40, 32, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#f4ffe0";
  context.lineWidth = 6;
  context.lineCap = "round";
  context.beginPath();
  context.arc(58, 52, 16, Math.PI * 1.15, Math.PI * 1.85);
  context.stroke();
  context.fillStyle = "#14211a";
  context.beginPath();
  context.arc(50, 66, 5, 0, Math.PI * 2);
  context.arc(78, 66, 5, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#f7f3e8";
  context.beginPath();
  context.arc(52, 64, 1.6, 0, Math.PI * 2);
  context.arc(80, 64, 1.6, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#14211a";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(64, 78, 10, 0.2, Math.PI - 0.2);
  context.stroke();
}

function drawMoth() {
  context.fillStyle = "rgba(8, 16, 12, 0.28)";
  context.beginPath();
  context.ellipse(64, 108, 32, 7, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(227, 154, 69, 0.22)";
  context.beginPath();
  context.ellipse(64, 62, 42, 28, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#e39a45";
  context.beginPath();
  context.ellipse(38, 52, 24, 16, -0.5, 0, Math.PI * 2);
  context.ellipse(90, 52, 24, 16, 0.5, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#c47a2c";
  context.beginPath();
  context.ellipse(42, 78, 18, 12, 0.4, 0, Math.PI * 2);
  context.ellipse(86, 78, 18, 12, -0.4, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#14211a";
  context.beginPath();
  context.ellipse(64, 70, 6, 22, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#14211a";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(60, 50);
  context.quadraticCurveTo(48, 28, 54, 16);
  context.moveTo(68, 50);
  context.quadraticCurveTo(80, 28, 74, 16);
  context.stroke();
  context.fillStyle = "#f7f3e8";
  context.beginPath();
  context.arc(54, 16, 2.2, 0, Math.PI * 2);
  context.arc(74, 16, 2.2, 0, Math.PI * 2);
  context.arc(60, 64, 1.6, 0, Math.PI * 2);
  context.arc(68, 64, 1.6, 0, Math.PI * 2);
  context.fill();
}

function drawNewt() {
  context.fillStyle = "rgba(8, 16, 12, 0.28)";
  context.beginPath();
  context.ellipse(70, 108, 36, 7, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#2a6270";
  context.beginPath();
  context.moveTo(96, 70);
  context.quadraticCurveTo(124, 64, 118, 96);
  context.quadraticCurveTo(100, 84, 96, 70);
  context.fill();
  context.fillStyle = "#3d8f8a";
  context.beginPath();
  context.ellipse(68, 72, 36, 18, -0.2, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#f6f1e4";
  context.beginPath();
  context.ellipse(72, 80, 22, 7, -0.15, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#2a6270";
  context.lineWidth = 3;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(52, 82);
  context.lineTo(44, 100);
  context.moveTo(66, 86);
  context.lineTo(62, 104);
  context.moveTo(84, 82);
  context.lineTo(92, 100);
  context.stroke();
  context.fillStyle = "#14211a";
  context.beginPath();
  context.arc(46, 64, 3.5, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#f7f3e8";
  context.beginPath();
  context.arc(47, 63, 1.2, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(20, 33, 26, 0.45)";
  context.beginPath();
  context.arc(74, 66, 2.4, 0, Math.PI * 2);
  context.arc(88, 74, 1.8, 0, Math.PI * 2);
  context.fill();
}

function drawPet(petType) {
  context.clearRect(0, 0, 128, 128);
  if (petType === "lantern_moth") drawMoth();
  else if (petType === "river_newt") drawNewt();
  else drawSlime();
}

function insideSprite(x, y) {
  const dx = (x - 64) / 48;
  const dy = (y - 68) / 44;
  return dx * dx + dy * dy <= 1;
}

drawPet("baby_slime");

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  window.pet.setPointerInside(
    insideSprite(event.clientX - rect.left, event.clientY - rect.top),
  );
});

canvas.addEventListener("mouseleave", () => {
  window.pet.setPointerInside(false);
});

canvas.addEventListener("click", () => {
  window.pet.togglePanel();
});

window.pet.onState((state) => {
  drawPet(state.petType);
  const name = state.petType
    ? state.petType
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : "Baby slime";
  caption.textContent = state.level ? `${name} · ${state.level}` : name;
});
