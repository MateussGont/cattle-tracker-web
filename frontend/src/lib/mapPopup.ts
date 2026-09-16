export interface MapPopupContent {
  title: string;
  details: string[];
}

export function createMapPopupContent(content: MapPopupContent): HTMLElement {
  const root = document.createElement("div");
  root.style.fontFamily = "system-ui, sans-serif";
  root.style.minWidth = "190px";

  const title = document.createElement("p");
  title.textContent = content.title;
  title.style.fontWeight = "600";
  title.style.margin = "0 0 4px";
  root.appendChild(title);

  for (const detail of content.details) {
    const line = document.createElement("p");
    line.textContent = detail;
    line.style.margin = "0";
    line.style.fontSize = "12px";
    line.style.color = "#475569";
    root.appendChild(line);
  }
  return root;
}
