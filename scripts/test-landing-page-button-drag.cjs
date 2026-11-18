// Regression: the painted button and label must have one free-layout owner in both render modes.
const fs=require('node:fs'),assert=require('node:assert/strict');
const ts=require(fs.existsSync('.tmp/work-qa-typescript.cjs')?'../.tmp/work-qa-typescript.cjs':'typescript');
const file='apps/web/src/components/landing-pages/landing-page-renderer.tsx';
const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const visit=(node,fn)=>{fn(node);ts.forEachChild(node,n=>visit(n,fn));};
let checked=0;
for(const name of ['cta','ctaAction']){
 let declaration;visit(ast,n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name&&n.initializer?.getText(ast).includes('showCanvasInlineField'))declaration=n;});
 assert.ok(declaration,name);
 const buttons=[],anchors=[];visit(declaration.initializer,n=>{
  if(ts.isJsxSelfClosingElement(n)&&n.tagName.getText(ast)==='InlineEditable')buttons.push(n);
  if(ts.isJsxOpeningElement(n)&&n.tagName.getText(ast)==='a')anchors.push(n);
 });
 assert.equal(buttons.length,1,`${name}: editor and preview share a single button`);
 assert.equal(anchors.length,0,`${name}: no static painted anchor outside the draggable label`);
 const attrs=new Map(buttons[0].attributes.properties.filter(ts.isJsxAttribute).map(a=>[a.name.getText(ast),a.initializer?.getText(ast)]));
 assert.ok(attrs.get('href')?.includes('block.ctaUrl'));
 assert.ok(attrs.get('as')?.includes('!canvas'));
 assert.ok(attrs.get('style')?.includes('borderRadius'));
 assert.ok(attrs.get('className')?.includes('after:content-'));
 assert.equal(attrs.get('field'),'"ctaLabel"','saved drag identity stays compatible');
 checked++;console.log('PASS '+name+': frame, label and arrow share the persisted drag owner');
}
console.log(JSON.stringify({passed:true,checked}));
