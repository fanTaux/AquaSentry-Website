export function clampExplosion(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0;
}

export function getPartPosition(part, explosion) {
  const progress = clampExplosion(explosion);
  return part.position.map((coordinate, axis) => coordinate + part.offset[axis] * progress);
}

export function filterComponents(parts, category, query = '') {
  const search = query.trim().toLocaleLowerCase('id');
  return parts.filter((part) => (
    (category === 'Semua' || part.category === category)
    && `${part.name} ${part.category}`.toLocaleLowerCase('id').includes(search)
  ));
}
