// Inventário estático: não acessa dados nem substitui testes de RLS/produção.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir,e.name)) : [path.join(dir,e.name)]);
const sql = files('supabase/migrations').filter(f=>f.endsWith('.sql')).map(f=>fs.readFileSync(f,'utf8')).join('\n');
const names = (regex) => new Set([...sql.matchAll(regex)].map(m=>m[1]));
const functions = names(/(?:create\s+(?:or\s+replace\s+)?)function\s+public\.(\w+)\s*\(/gi);
const tables = names(/create\s+(?:table|view)\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/gi);
const calls=[];
for(const file of files('src').filter(f=>/\.tsx?$/.test(f))) {
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 const visit=(node)=>{
  if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&['rpc','from'].includes(node.expression.name.text) && !['Array','Buffer','Uint8Array'].includes(node.expression.expression.getText(source))) {
   const arg=node.arguments[0], name=arg && ts.isStringLiteral(arg)?arg.text:null;
   const kind=node.expression.name.text==='rpc'?'rpc':node.expression.expression.getText(source).includes('.storage')?'storage':'table';
   const params=node.arguments[1];
   calls.push({file,line:source.getLineAndCharacterOfPosition(node.getStart()).line+1,kind,name,dynamic:!name,
    ...(kind==='rpc'&&params&&ts.isObjectLiteralExpression(params)?{arguments:params.properties.map(p=>p.name?.getText(source)).filter(Boolean)}:{}),
    ...(name&&kind!=='storage'?{present_in_migrations:(kind==='rpc'?functions:tables).has(name)}:{})});
  }
  ts.forEachChild(node,visit);
 };
 visit(source);
}
const unique=(kind)=>[...new Set(calls.filter(c=>c.kind===kind&&c.name).map(c=>c.name))].sort();
const report={summary:{rpc_functions:unique('rpc').length,tables_and_views:unique('table').length,storage_buckets:unique('storage').length},missing:calls.filter(c=>c.present_in_migrations===false),dynamic:calls.filter(c=>c.dynamic),calls};
if(process.argv.includes('--json')) process.stdout.write(JSON.stringify(report,null,2)+'\n');
else console.log(JSON.stringify({summary:report.summary,missing:report.missing,dynamic:report.dynamic},null,2));
process.exitCode=report.missing.length?1:0;
