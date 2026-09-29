// test_related.js — shows the "related concepts not mentioned" suggestions for each sample, outside a browser.
// Usage: node test_related.js
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/docs/index.html', 'utf8');
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const els = {};
const mk = id => els[id] || (els[id] = {id, textContent:'', innerHTML:'', hidden:false, style:{}, addEventListener(){}, dataset:{}, value:'', checked:true, className:'', scrollHeight:200, focus(){}});
global.document = {getElementById: mk};

eval(js + `
const strip = s => s.replace(/<[^>]+>/g, ' | ').replace(/\\s+/g, ' ').trim();
for (const s of SAMPLES){
  mk('txt').value = s.text; run();
  console.log('== ' + s.name);
  console.log('   chips linking to the FAIR site: ' + (mk('chips').innerHTML.match(/cgiar-climate-taxonomy/g) || []).length);
  console.log('   ' + (mk('related').hidden ? '(no suggestions)' : strip(mk('related').innerHTML).slice(0, 420)));
}
`);
