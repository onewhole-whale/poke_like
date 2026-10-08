

/* ===== M2-A5 体力系统 =====
   体力上限 120；每 6 分钟自然恢复 1（离线也恢复，按时间戳惰性结算）；
   元素微粒=口粮，消耗 1 单位立即 +20 体力；冒险 / 秘境 / 挂机分别消耗。 */
function staminaNow(){
  const now = Date.now();
  const el = Math.floor((now - (S.staminaAt||now)) / 360000);   // M3-1 每 6min +1
  if(el>0 && S.stamina < S.staminaMax){
    S.stamina = Math.min(S.staminaMax, S.stamina + el);
    S.staminaAt = now;
  }
  return S.stamina;
}
function spendStamina(n){
  if(staminaNow() < n) return false;
  S.stamina -= n; S.staminaAt = Date.now();
  return true;
}
function staminaNextIn(){   // 距离下一点恢复的分钟数
  const now = Date.now();
  if(S.stamina >= S.staminaMax) return 0;
  const passed = (now - (S.staminaAt||now)) / 60000;
  return Math.max(0, Math.ceil(6 - passed));
}