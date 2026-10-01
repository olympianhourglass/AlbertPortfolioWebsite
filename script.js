// Set current year in footer
document.getElementById("year").textContent = new Date().getFullYear();

// Mobile nav toggle
const toggle = document.querySelector(".nav-toggle");
const links = document.querySelector(".nav-links");

if (toggle && links) {
  toggle.addEventListener("click", () => {
    const isOpen = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  // Close menu when a link is clicked (mobile)
  links.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      links.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

// Gradient cloud field — colors extracted from the two Figma frames
(function buildCloudField() {
  const canvas = document.getElementById("cloudCanvas");
  if (!canvas) return;

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // Two palettes pulled from Figma, made glossy
  const palettes = [
    {
      // Warm frame: cream -> rose -> hot pink
      bg:
        "linear-gradient(135deg, #f6f7e8 0%, #f1ede1 28%, #f3cfe0 60%, #ff5bb0 100%)",
      glow: "rgba(255, 91, 176, 0.5)",
    },
    {
      // Cool frame: steel blue -> blue-grey -> cream
      bg:
        "linear-gradient(135deg, #557c92 0%, #6b8ca1 30%, #a7bccb 62%, #eef1ec 100%)",
      glow: "rgba(107, 160, 185, 0.5)",
    },
  ];

  const rand = (min, max) => min + Math.random() * (max - min);
  const COUNT = 12;

  for (let i = 0; i < COUNT; i++) {
    const slab = document.createElement("div");
    slab.className = "cloud-slab";

    const pal = palettes[i % palettes.length];
    const depth = Math.random(); // 0 = near, 1 = far

    // Size, bigger when nearer
    const w = rand(170, 400) * (1.15 - depth * 0.35);
    const h = w * rand(0.42, 0.6);

    // Depth-based parallax cues
    const scale = 1.1 - depth * 0.55;
    const blur = depth * 4.5;
    const opacity = 1 - depth * 0.5;

    // 3D posture
    const tiltX = rand(44, 64);
    const rotZ = rand(-14, 14);

    // Drift timing — farther clouds move slower
    const duration = rand(42, 70) + depth * 24;
    const delay = -rand(0, duration);
    const goRight = Math.random() > 0.5;

    slab.style.width = `${w.toFixed(0)}px`;
    slab.style.height = `${h.toFixed(0)}px`;
    slab.style.top = `${rand(2, 78).toFixed(1)}%`;
    slab.style.setProperty("--bg", pal.bg);
    slab.style.setProperty("--glow", pal.glow);
    slab.style.setProperty("--scale", scale.toFixed(3));
    slab.style.setProperty("--blur", `${blur.toFixed(2)}px`);
    slab.style.setProperty("--opacity", opacity.toFixed(3));
    slab.style.setProperty("--tiltX", `${tiltX.toFixed(1)}deg`);
    slab.style.setProperty("--rotZ", `${rotZ.toFixed(1)}deg`);
    slab.style.setProperty("--sheenDelay", `${rand(0, 8).toFixed(2)}s`);
    slab.style.zIndex = String(Math.round((1 - depth) * 10));

    if (reduceMotion) {
      // Static, pleasant arrangement without animation
      slab.style.left = `${rand(5, 70).toFixed(1)}%`;
    } else {
      slab.style.animation = `${goRight ? "driftR" : "driftL"} ${duration.toFixed(
        1
      )}s linear ${delay.toFixed(1)}s infinite`;
    }

    canvas.appendChild(slab);
  }
})();
