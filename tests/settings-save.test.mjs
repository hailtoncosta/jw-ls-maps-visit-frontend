import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const source = readFileSync(new URL('../src/api/apiClient.js', import.meta.url), 'utf8');
function client() {
  const calls = [];
  const saved = { id: 'current', full_name: 'Ana', cidade: 'Nampula', estado: 'NA', role: 'helper' };
  const http = {
    interceptors: { request: { use() {} }, response: { use() {} } },
    async get(url) { calls.push(['GET', url]); return { data: saved }; },
    async put(url, body) { calls.push(['PUT', url, body]); return { data: saved }; },
  };
  const context = vm.createContext({ axios: { create: () => http }, localStorage: { getItem() {} } });
  vm.runInContext(source.replace(/^import .*;\n/, '').replaceAll('export ', '') + '\nglobalThis.result = api;', context);
  return { api: context.result, calls };
}
test('salvamento usa o próprio perfil e normaliza os dados retornados', async () => {
  const { api, calls } = client();
  const form = { publisher_name: 'Ana', default_city: 'Nampula', default_state: 'NA' };
  const saved = await api.auth.updateMe(form);
  assert.deepEqual(calls, [['PUT', '/users/me', form]]);
  assert.equal(saved.publisher_name, 'Ana');
  assert.equal(saved.default_city, 'Nampula');
  assert.equal(saved.default_state, 'NA');
  assert.equal(saved.role, 'helper');
});
test('reabrir configurações recupera nome, cidade e estado', async () => {
  const { api } = client();
  const saved = await api.auth.me();
  assert.equal(saved.publisher_name, 'Ana');
  assert.equal(saved.default_city, 'Nampula');
  assert.equal(saved.default_state, 'NA');
});
const settings = readFileSync(new URL('../src/pages/Settings.jsx', import.meta.url), 'utf8');
const handler = settings.split('const handleSave = async () => {')[1].split('\n  };')[0];
async function saveScenario(fail) {
  const events = [];
  const context = vm.createContext({ saving: false, form: {},
    setSaving: value => events.push(['saving', value]),
    setUser: () => events.push(['user']), setForm: () => events.push(['form']),
    t: key => key, toast: { success: () => events.push(['success']), error: () => events.push(['error']) },
    api: { auth: { updateMe: async () => { if (fail) throw new Error('Falha da API'); return {}; } } },
  });
  await vm.runInContext('(async () => {' + handler + '})()', context);
  return events;
}
test('falha libera o botão e apresenta erro sem indicar sucesso', async () => {
  assert.deepEqual(await saveScenario(true), [['saving', true], ['error'], ['saving', false]]);
});
test('sucesso atualiza a tela e libera o botão', async () => {
  assert.deepEqual(await saveScenario(false), [['saving', true], ['user'], ['form'], ['success'], ['saving', false]]);
});
