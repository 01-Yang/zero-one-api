const css = `.console-route-content{animation:console-route-content-in 180ms cubic-bezier(.22,1,.36,1) both}@keyframes console-route-content-in{from{opacity:.92;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}@media (prefers-reduced-motion: reduce){.console-route-content{animation:none}}`

if (typeof document !== "undefined" && !document.getElementById("app-layout-route-style")) {
  const style = document.createElement("style")
  style.id = "app-layout-route-style"
  style.textContent = css
  document.head.appendChild(style)
}
