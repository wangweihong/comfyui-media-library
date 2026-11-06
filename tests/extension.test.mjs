import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('traditional and Nodes 2.0 widgets preserve DOM, serialization and scope checks',async()=>{
  let extension;
  class Element{constructor(){this.style={};this.children=[];}append(...x){this.children.push(...x);}}
  class Node{constructor(){this.widgets=[{name:'file_path',value:''},{name:'asset_id',value:''}];this.dom=[];}addDOMWidget(name,type,element,options){this.dom.push({name,type,element,options});}setSize(){}setDirtyCanvas(){}}
  const context=vm.createContext({document:{createElement:()=>new Element()},URLSearchParams,
    app:{registerExtension:x=>extension=x,graph:{change(){}}},api:{apiURL:x=>x},window:{},location:{origin:'http://test'}});
  const code=readFileSync(new URL('../web/extensions/media_library.js',import.meta.url),'utf8').replace(/^import .*;\s*$/gm,'');
  vm.runInContext(code,context);await extension.beforeRegisterNodeDef(Node,{name:'MediaLibraryPath'});const node=new Node();node.onNodeCreated();
  const native=new Set(['button','text','string','STRING','image','video','audio','markdown']);
  for(const widget of node.dom){assert.ok(!native.has(widget.type));assert.equal(widget.options.serialize,false);assert.ok(widget.element);}
  assert.equal(node.widgets[1].value,'');assert.equal(node.widgets[1].hidden,true);
  assert.match(code,/event\.origin !== location\.origin/);assert.match(code,/event\.source !== frame\?\.contentWindow/);
});
