export function createLocalStudioBackground(width: number, height: number, jpegQuality: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas недоступен в этом браузере.");

  const wall = context.createLinearGradient(0, 0, 0, height);
  wall.addColorStop(0, "#f7f7f5");
  wall.addColorStop(0.52, "#e9e8e4");
  wall.addColorStop(1, "#d8d6d1");
  context.fillStyle = wall;
  context.fillRect(0, 0, width, height);

  const floorY = height * 0.62;
  const sweep = context.createLinearGradient(0, floorY - height * 0.2, 0, height);
  sweep.addColorStop(0, "rgba(255,255,255,0)");
  sweep.addColorStop(0.34, "rgba(255,255,255,0.42)");
  sweep.addColorStop(1, "rgba(208,205,198,0.52)");
  context.fillStyle = sweep;
  context.fillRect(0, floorY - height * 0.28, width, height * 0.66);

  context.save();
  context.filter = `blur(${Math.max(18, Math.round(width * 0.04))}px)`;
  const leftLight = context.createRadialGradient(width * 0.18, height * 0.2, 0, width * 0.18, height * 0.2, width * 0.55);
  leftLight.addColorStop(0, "rgba(255,255,255,0.58)");
  leftLight.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = leftLight;
  context.fillRect(0, 0, width, height);

  const rightLight = context.createRadialGradient(width * 0.82, height * 0.26, 0, width * 0.82, height * 0.26, width * 0.48);
  rightLight.addColorStop(0, "rgba(255,255,255,0.34)");
  rightLight.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = rightLight;
  context.fillRect(0, 0, width, height);
  context.restore();

  context.globalAlpha = 0.06;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const value = ((x * 17 + y * 31) % 13) / 13;
      context.fillStyle = value > 0.5 ? "#ffffff" : "#8f8b84";
      context.fillRect(x, y, 1, 1);
    }
  }
  context.globalAlpha = 1;

  return canvas.toDataURL("image/jpeg", jpegQuality);
}
