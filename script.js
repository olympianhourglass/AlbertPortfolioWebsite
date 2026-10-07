document.getElementById("year").textContent = new Date().getFullYear();

const toggle = document.querySelector(".nav-toggle");
const links = document.querySelector(".nav-links");
const viewPortfolio = document.getElementById("view-portfolio");
const viewExperiments = document.getElementById("experiments");

const EXPERIMENT_IDS = new Set([
  "experiments",
  "showcase",
  "showcase-play",
  "showcase-toys",
  "showcase-cloth",
  "showcase-cloth-violet",
  "showcase-cloth-plum",
]);

function setView(name, id) {
  const experiments = name === "experiments";
  viewPortfolio?.classList.toggle("is-active", !experiments);
  viewExperiments?.classList.toggle("is-active", experiments);
  if (viewExperiments) viewExperiments.hidden = !experiments;
  document.body.dataset.view = name;

  const current = experiments ? "experiments" : id;
  document.querySelectorAll(".nav-links a").forEach((link) => {
    const href = (link.getAttribute("href") || "").slice(1);
    const on = href === current;
    link.classList.toggle("is-current", on);
    if (on) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function applyHash() {
  const id = location.hash.slice(1);
  const experiments = EXPERIMENT_IDS.has(id);
  setView(experiments ? "experiments" : "portfolio", id);

  const targetId =
    !id || id === "home" || id === "experiments" ? null : id;
  const target = targetId ? document.getElementById(targetId) : null;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
      if (target) {
        target.scrollIntoView({ behavior: "auto", block: "start" });
      } else {
        window.scrollTo(0, 0);
      }
    });
  });
}

window.addEventListener("hashchange", applyHash);
applyHash();

if (toggle && links) {
  toggle.addEventListener("click", () => {
    const isOpen = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  links.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      links.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}
