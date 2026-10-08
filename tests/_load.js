// 按 src/modules.txt 的顺序拼接数据与模块，供各测试脚本 eval。
// 页面里的 script 标签和这份清单是同一份顺序。
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..');
function loadGame(){
  const order = fs.readFileSync(path.join(DIR, 'src', 'modules.txt'), 'utf8')
    .split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  return order.map(rel => fs.readFileSync(path.join(DIR, rel), 'utf8')).join('\n');
}
module.exports = { loadGame };
