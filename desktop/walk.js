/** Moves a sprite-sized window across usable desktop rects. */

function step(origin, velocity, windowSize, rects) {
  const candidate = add(origin, velocity);
  if (fits(candidate, windowSize, rects)) {
    return { position: candidate, velocity: { ...velocity } };
  }

  const jumped = jump(origin, velocity, windowSize, rects);
  if (jumped) {
    return { position: jumped, velocity: { ...velocity } };
  }

  const turned = { ...velocity };
  if (!fits({ x: origin.x + velocity.x, y: origin.y }, windowSize, rects)) {
    turned.x = -velocity.x;
  }
  if (!fits({ x: origin.x, y: origin.y + velocity.y }, windowSize, rects)) {
    turned.y = -velocity.y;
  }
  let bounced = add(origin, turned);
  if (!fits(bounced, windowSize, rects)) bounced = { ...origin };
  return { position: bounced, velocity: turned };
}

function fits(origin, windowSize, rects) {
  if (windowSize.x <= 0 || windowSize.y <= 0) return false;
  return rects.some((area) => encloses(area, origin, windowSize));
}

function jump(origin, velocity, windowSize, rects) {
  const current = enclosing(origin, windowSize, rects);
  if (!current || !againstEdge(origin, windowSize, current, velocity)) return null;
  for (const other of rects) {
    if (sameRect(other, current) || !touches(current, other, velocity)) continue;
    const landed = land(origin, windowSize, other, velocity);
    if (fits(landed, windowSize, [other])) return landed;
  }
  return null;
}

function enclosing(origin, windowSize, rects) {
  return rects.find((area) => encloses(area, origin, windowSize)) ?? null;
}

function encloses(area, origin, windowSize) {
  return (
    origin.x >= area.x &&
    origin.y >= area.y &&
    origin.x + windowSize.x <= area.x + area.width &&
    origin.y + windowSize.y <= area.y + area.height
  );
}

function againstEdge(origin, windowSize, area, velocity) {
  const endX = origin.x + windowSize.x;
  const endY = origin.y + windowSize.y;
  const areaEndX = area.x + area.width;
  const areaEndY = area.y + area.height;
  if (velocity.x > 0 && endX > areaEndX - velocity.x && endX <= areaEndX) return true;
  if (velocity.x < 0 && origin.x < area.x - velocity.x && origin.x >= area.x) return true;
  if (velocity.y > 0 && endY > areaEndY - velocity.y && endY <= areaEndY) return true;
  if (velocity.y < 0 && origin.y < area.y - velocity.y && origin.y >= area.y) return true;
  return false;
}

function touches(current, other, velocity) {
  const currentEndX = current.x + current.width;
  const currentEndY = current.y + current.height;
  const otherEndX = other.x + other.width;
  const otherEndY = other.y + other.height;
  if (velocity.x > 0 && other.x === currentEndX) {
    return overlap(current.y, currentEndY, other.y, otherEndY);
  }
  if (velocity.x < 0 && otherEndX === current.x) {
    return overlap(current.y, currentEndY, other.y, otherEndY);
  }
  if (velocity.y > 0 && other.y === currentEndY) {
    return overlap(current.x, currentEndX, other.x, otherEndX);
  }
  if (velocity.y < 0 && otherEndY === current.y) {
    return overlap(current.x, currentEndX, other.x, otherEndX);
  }
  return false;
}

function overlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function land(origin, windowSize, other, velocity) {
  const landed = { ...origin };
  if (velocity.x > 0) landed.x = other.x;
  else if (velocity.x < 0) landed.x = other.x + other.width - windowSize.x;
  else landed.x = clamp(origin.x, other.x, other.x + other.width - windowSize.x);
  if (velocity.y > 0) landed.y = other.y;
  else if (velocity.y < 0) landed.y = other.y + other.height - windowSize.y;
  else landed.y = clamp(origin.y, other.y, other.y + other.height - windowSize.y);
  return landed;
}

function add(origin, velocity) {
  return { x: origin.x + velocity.x, y: origin.y + velocity.y };
}

function sameRect(a, b) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

module.exports = { step };
