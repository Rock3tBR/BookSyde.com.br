const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/lib/profilePhone.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} };
vm.runInNewContext(output, context);
const { normalizeBrazilianPhone } = context.exports;
const tests = [
  ['', ''],
  ['   ', ''],
  ['(11) 99999-9999', '+5511999999999'],
  ['11999999999', '+5511999999999'],
  ['+55 (11) 99999-9999', '+5511999999999'],
  ['11 3333-3333', '+551133333333'],
  ['11 9999', null],
  ['abc', null],
  ['00000000000', null],
  ['+55 11 99999 99999 99', null],
];
for (const [input, expected] of tests) assert.equal(normalizeBrazilianPhone(input), expected, input);
console.log(`Phone normalization: ${tests.length} tests passed.`);
