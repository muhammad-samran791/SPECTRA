function refractRay(dir, normal, n1, n2) {
  const r = n1/n2, c = -dot(normal, dir);
  const k = 1 - r*r*(1-c*c);
  if (k < 0) return null;
  return normalize(add(mul(dir,r), mul(normal,r*c-Math.sqrt(k))));
}
