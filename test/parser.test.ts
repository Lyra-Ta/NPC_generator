import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCharacterInfo } from '../src/parser.ts';

test('解析传统中文角色标签', () => {
  const result = parseCharacterInfo('<张三_info>name: 张三</张三_info>');
  assert.equal(result.length, 1);
  assert.equal(result[0].name, '张三');
});

test('角色名允许空格、横线、下划线和货币符号', () => {
  const message = [
    '<A B_info>space</A B_info>',
    '<Jean-Luc_info>hyphen</Jean-Luc_info>',
    '<A_B_info>underscore</A_B_info>',
    '<¥$_info>symbols</¥$_info>',
    '<玛丽·简_info>middle dot</玛丽·简_info>',
  ].join('\n');

  assert.deepEqual(
    parseCharacterInfo(message).map(item => item.name),
    ['A B', 'Jean-Luc', 'A_B', '¥$', '玛丽·简'],
  );
});

test('闭合标签必须与开标签角色名完全一致', () => {
  assert.deepEqual(parseCharacterInfo('<A B_info>content</A-B_info>'), []);
});

test('跳过空档案并合并同名的多个完整标签块', () => {
  const result = parseCharacterInfo('<A B_info>one</A B_info>\n<A B_info>two</A B_info>\n<X_info> </X_info>');
  assert.equal(result.length, 1);
  assert.equal(result[0].occurrences, 2);
  assert.equal(result[0].fragments.length, 2);
  assert.match(result[0].content, /one[\s\S]*two/);
});

test('名称不能包含会破坏标签边界的尖括号或换行', () => {
  assert.deepEqual(parseCharacterInfo('<A>B_info>content</A>B_info>'), []);
  assert.deepEqual(parseCharacterInfo('<A\nB_info>content</A\nB_info>'), []);
});

test('兼容移动端常见的标签尾部空白和 emoji 名称', () => {
  const result = parseCharacterInfo('<A B_info   >space</A B_info >\n<👩‍🔬_info>emoji</👩‍🔬_info>');
  assert.deepEqual(
    result.map(item => item.name),
    ['A B', '👩‍🔬'],
  );
});

test('连续解析不同楼层时会正确重置正则游标', () => {
  assert.equal(parseCharacterInfo('<第一人_info>one</第一人_info>')[0]?.name, '第一人');
  assert.equal(parseCharacterInfo('<第二人_info>two</第二人_info>')[0]?.name, '第二人');
});
