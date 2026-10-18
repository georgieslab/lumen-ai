import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createProjectStore } from '../services/projectStore.js';

async function fixture(t, options = {}) {
  const scratch = path.resolve('scratch');
  await mkdir(scratch, { recursive: true });
  const directory = await mkdtemp(path.join(scratch, 'lumen-project-store-'));
  t.after(async () => { assert.equal(path.dirname(directory), scratch); await rm(directory, { recursive: true, force: true }); });
  const store = createProjectStore({ directory, ...options });
  await store.ready;
  return { store, directory };
}

test('projects persist metadata, instructions, files and reference-only pins across reopen', async (t) => {
  const { store, directory } = await fixture(t);
  const created = await store.create('owner', { name: 'Launch', description: 'A useful launch', instructions: 'Use our brand voice.' });
  assert.equal(created.ownerId, undefined);
  let saved = await store.addFile(created.id, 'owner', { name: 'brief.md', text: '# Launch\nKeep actual line breaks.' });
  saved = await store.pin(created.id, 'owner', { missionId: randomUUID(), widgetId: 'checklist-a', widgetType: 'checklist', title: 'Launch tasks' });
  assert.equal(saved.revision, 3);
  const restored = await createProjectStore({ directory }).get(created.id, 'owner');
  assert.deepEqual(restored, saved);
  assert.equal(restored.files[0].text, '# Launch\nKeep actual line breaks.');
  assert.deepEqual(Object.keys(restored.pins[0]).sort(), ['createdAt', 'id', 'missionId', 'title', 'widgetId', 'widgetType']);
  const listed = (await store.list('owner'))[0];
  assert.equal(listed.fileCount, 1); assert.equal(listed.pinCount, 1);
  assert.equal(listed.instructions, undefined); assert.equal(listed.files, undefined);
  assert.deepEqual(await readdir(directory), [`${created.id}.json`]);
  assert.equal(JSON.parse(await readFile(path.join(directory, `${created.id}.json`), 'utf8')).ownerId, 'owner');
});

test('ownership covers reads, modifications, files and pins; arbitrary paths are rejected', async (t) => {
  const { store } = await fixture(t);
  const created = await store.create('owner', { name: 'Private' });
  const saved = await store.addFile(created.id, 'owner', { name: 'data.csv', text: 'a,b\n1,2' });
  const pin = { missionId: randomUUID(), widgetId: 'budget-a', widgetType: 'budget', title: 'Budget' };
  const pinned = await store.pin(created.id, 'owner', pin);
  assert.equal(await store.get(created.id, 'other'), null);
  assert.deepEqual(await store.list('other'), []);
  for (const operation of [
    () => store.update(created.id, 'other', { name: 'Taken' }),
    () => store.addFile(created.id, 'other', { name: 'new.txt', text: 'Bad' }),
    () => store.removeFile(created.id, 'other', saved.files[0].id),
    () => store.pin(created.id, 'other', pin),
    () => store.unpin(created.id, 'other', pinned.pins[0].id)
  ]) await assert.rejects(operation(), { status: 404 });
  for (const id of ['../outside', `${created.id}/../secret`, '', null]) await assert.rejects(store.get(id, 'owner'), { status: 400 });
  await assert.rejects(store.removeFile(created.id, 'owner', '../bad'), { status: 400 });
  await assert.rejects(store.unpin(created.id, 'owner', '../bad'), { status: 400 });
});

test('project metadata rejects unknown fields, invalid values and excessive instructions', async (t) => {
  const { store } = await fixture(t);
  for (const input of [{ name: '' }, { name: 'x'.repeat(101) }, { name: 'A', ownerId: 'other' },
    { name: 'A', description: 'x'.repeat(2001) }, { name: 'A', instructions: 'x'.repeat(12001) }, []]) {
    await assert.rejects(store.create('owner', input), { status: 400 });
  }
  const project = await store.create('owner', { name: 'Okay' });
  for (const patch of [{}, { id: randomUUID() }, { archived: 'true' }, { name: null }]) await assert.rejects(store.update(project.id, 'owner', patch), { status: 400 });
  assert.equal((await store.get(project.id, 'owner')).name, 'Okay');
});

test('active project quotas serialize creation and reversible archive/restore', async (t) => {
  const { store } = await fixture(t, { maxActivePerOwner: 1 });
  const created = await store.create('owner', { name: 'First' });
  await assert.rejects(store.create('owner', { name: 'Second' }), { status: 429 });
  const archived = await store.update(created.id, 'owner', { archived: true });
  assert.equal(archived.archived, true);
  assert.deepEqual(await store.list('owner'), []);
  assert.equal((await store.list('owner', { includeArchived: true })).length, 1);
  const other = await store.create('owner', { name: 'Second' });
  await assert.rejects(store.update(created.id, 'owner', { archived: false }), { status: 429 });
  await store.update(other.id, 'owner', { archived: true });
  assert.equal((await store.update(created.id, 'owner', { archived: false })).archived, false);
  const secondOwner = await store.create('other', { name: 'Independent quota' });
  assert.ok(secondOwner.id);
});

test('text files preserve content, restrict extensions and enforce individual and aggregate bounds', async (t) => {
  const { store } = await fixture(t);
  const project = await store.create('owner', { name: 'Research' });
  for (const input of [ { name: '../brief.md', text: 'No' }, { name: 'image.png', text: 'No' },
    { name: 'file.txt', text: 'a\0b' }, { name: 'file.txt', text: '' }, { name: 'file.txt', text: 'x'.repeat(100001) } ]) {
    await assert.rejects(store.addFile(project.id, 'owner', input), { status: 400 });
  }
  for (let i = 0; i < 4; i++) await store.addFile(project.id, 'owner', { name: `part-${i}.txt`, text: 'x'.repeat(100000) });
  await assert.rejects(store.addFile(project.id, 'owner', { name: 'extra.json', text: '{}' }), { status: 413 });
  await assert.rejects(store.update(project.id, 'owner', { instructions: 'Too much' }), { status: 413 });
  const full = await store.get(project.id, 'owner');
  await assert.rejects(store.addFile(project.id, 'owner', { name: 'PART-0.TXT', text: 'Duplicate' }), { status: 409 });
  const reduced = await store.removeFile(project.id, 'owner', full.files[0].id);
  assert.equal(reduced.files.length, 3);
  assert.equal((await store.update(project.id, 'owner', { instructions: 'New room' })).instructions, 'New room');
});

test('file count and pin bounds are checked without storing artifact payloads', async (t) => {
  const { store } = await fixture(t);
  const project = await store.create('owner', { name: 'Files' });
  await Promise.all(Array.from({ length: 10 }, (_, i) => store.addFile(project.id, 'owner', { name: `${i}.txt`, text: `File ${i}` })));
  await assert.rejects(store.addFile(project.id, 'owner', { name: 'last.txt', text: 'No room' }), { status: 429 });
  const pin = { missionId: randomUUID(), widgetId: 'tasks', widgetType: 'checklist', title: 'Tasks' };
  const first = await store.pin(project.id, 'owner', pin);
  const replay = await store.pin(project.id, 'owner', pin);
  assert.equal(replay.pins.length, 1); assert.equal(replay.revision, first.revision);
  await assert.rejects(store.pin(project.id, 'owner', { ...pin, widget: { payload: 'Do not copy outputs here' } }), { status: 400 });
  await store.update(project.id, 'owner', { archived: true });
  await assert.rejects(store.addFile(project.id, 'owner', { name: 'new.txt', text: 'No' }), { status: 409 });
  await assert.rejects(store.pin(project.id, 'owner', { ...pin, widgetId: 'new' }), { status: 409 });
  assert.equal((await store.unpin(project.id, 'owner', first.pins[0].id)).pins.length, 0);
});

test('malformed project files are isolated during load', async (t) => {
  const { store, directory } = await fixture(t);
  const healthy = await store.create('owner', { name: 'Healthy' });
  const raw = JSON.parse(await readFile(path.join(directory, `${healthy.id}.json`), 'utf8'));
  for (const patch of [{ files: 'bad' }, { pins: [null] }, { instructions: null }, { name: '' }, { archived: 'yes' }]) {
    const id = randomUUID();
    await writeFile(path.join(directory, `${id}.json`), JSON.stringify({ ...raw, ...patch, id }));
  }
  await writeFile(path.join(directory, `${randomUUID()}.json`), 'invalid JSON');
  const reopened = createProjectStore({ directory });
  assert.equal((await reopened.list('owner')).length, 1);
  assert.equal((await reopened.get(healthy.id, 'owner')).name, 'Healthy');
});

test('storage failures return a generic service error without local paths', async (t) => {
  const { directory } = await fixture(t);
  const notDirectory = path.join(directory, 'private-project-data.txt');
  await writeFile(notDirectory, 'A file cannot be used as a storage directory.');
  const unavailable = createProjectStore({ directory: notDirectory });
  await assert.rejects(unavailable.ready, (error) => {
    assert.equal(error.status, 503);
    assert.equal(error.message, 'Project storage is temporarily unavailable.');
    assert.doesNotMatch(error.message, /private-project|[A-Z]:/);
    return true;
  });
});
