// test_rule.js — runs the page's matcher and verdict engine on the built-in samples, outside a browser.
// Usage: node test_rule.js
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/docs/index.html', 'utf8');
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const stub = {textContent:'', innerHTML:'', hidden:false, style:{}, addEventListener(){}, dataset:{}, value:'', offsetHeight:0, checked:true, className:''};
global.document = {getElementById: () => stub};
global.ResizeObserver = class { observe(){} };

eval(js.slice(0, js.indexOf('// ---------- rendering')) + `
const strip = s => s ? s.replace(/<[^>]+>/g, '') : '';
for (const s of SAMPLES){
  const ms = analyze(s.text);
  for (const proxy of [true, false]){
    const a = score(ms, 'adaptation', proxy), m = score(ms, 'mitigation', proxy);
    console.log('');
    console.log('== ' + s.name + '  [proxy ' + (proxy ? 'on' : 'off') + ']');
    console.log('   adaptation: ' + a.verdict + ' ' + a.weight.toFixed(2) + '  elements: ' + (a.present.join(', ') || '-') + '   | mitigation: ' + m.verdict);
    if (proxy) for (const r of a.rows)
      console.log('   ' + (r.element ? '● ' : '○ ') + r.c.term.padEnd(30) + (r.c.adaptation || '').padEnd(24) + (r.element || '-').padEnd(20) + strip(r.how));
  }
}
`);
