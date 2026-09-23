function effectivePoints(u, now) {
  // bônus por eventos +5/mês de conta (teto 60 = 12 meses). Vale como peso do voto.
  const bonus = Number(u.points || 0);
  let months = 0;
  const created = new Date(u.created_at);
  if (!isNaN(created)) {
    months = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
    if (now.getDate() < created.getDate()) months--;
    months = Math.max(0, Math.min(12, months));
  }
  return bonus + months * 5;
}
