// tools/cli.mjs — one message to Claude through the official claude CLI on Simon's own login (glue, local only): text,
// optionally with one PNG, no tools, no settings, nothing saved. Returns the reply and the tokens the CLI billed.
// The same plumbing as kar-mind tools/claude-count.mjs (claude-session.mjs finds the newest CLI; cleanEnv strips
// ANTHROPIC_* so the CLI's own login is used — init.apiKeySource "none").
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const MODEL = 'claude-sonnet-5-5';
let ctx = null;
async function setup() {
  if (ctx) return ctx;
  const S = await import(pathToFileURL('C:/Users/sjgan/si-didy/claude-session.mjs').href);
  const KK = (await import(pathToFileURL('C:/Users/sjgan/si-didy/cockpit-kernel.mjs').href)).default;
  const cli = S.findNewestCli();
  if (!cli) throw new Error('no claude CLI');
  mkdirSync('C:\\tmp\\kar-cockpit', { recursive: true });
  ctx = { cli, env: KK.cleanEnv(process.env), cwd: mkdtempSync('C:\\tmp\\kar-cockpit\\tongue-') };
  return ctx;
}

export async function ask({ text, image = null, system = 'Reply with the one word: ok', model = MODEL, timeoutMs = 300000 }) {
  const { cli, env, cwd } = await setup();
  return new Promise((done, fail) => {
    const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--model', model, '--system-prompt', system,
      '--tools', '', '--setting-sources', 'project', '--strict-mcp-config', '--no-session-persistence', '--disable-slash-commands', '--no-chrome'];
    const child = spawn(cli.path, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    const t0 = Date.now();
    const timer = setTimeout(() => { child.kill(); fail(new Error('timed out')); }, timeoutMs);
    let buf = '', result = null, init = null;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const l = buf.slice(0, i); buf = buf.slice(i + 1);
        try { const e = JSON.parse(l); if (e.type === 'system' && e.subtype === 'init') init = e; if (e.type === 'result') { result = e; child.stdin.end(); } } catch { /* */ }
      }
    });
    child.on('close', () => {
      clearTimeout(timer);
      if (!result || !result.usage) return fail(new Error('no usage from the CLI'));
      const u = result.usage;
      done({ reply: String(result.result || ''), input: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0),
        output: u.output_tokens || 0, model: init && init.model, login: init ? init.apiKeySource === 'none' : null, ms: Date.now() - t0 });
    });
    const content = [];
    if (image) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: readFileSync(image).toString('base64') } });
    content.push({ type: 'text', text });
    child.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content } }) + '\n');
  });
}
