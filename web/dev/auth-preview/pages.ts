import { previewCopy as t, scenarioNames } from './fixtures';

const styles = `*{box-sizing:border-box}body{margin:0;background:#f8faf9;color:#16231d;font:14px system-ui,sans-serif}header{padding:20px 28px;border-bottom:1px solid #e0e7e3;background:white}h1{font-size:19px;letter-spacing:-.4px;margin:0 0 6px}p{color:#63756b;margin:0;line-height:1.6}.tools{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:16px}label{display:flex;align-items:center;gap:8px}select,button,a{font:inherit;color:inherit}select,button,.link{border:1px solid #cfdbd4;border-radius:7px;background:white;padding:7px 11px}button,a{cursor:pointer}.link{text-decoration:none}iframe{border:0;width:100%;height:calc(100dvh - 170px);background:white}.success{min-height:100dvh;display:grid;place-items:center}.card{padding:32px;border:1px solid #dbe6de;border-radius:16px;background:white;max-width:420px;margin:20px}.card h1{font-size:25px}.card p{margin:12px 0 24px}@media(max-width:600px){header{padding:15px}.tools{gap:8px}iframe{height:calc(100dvh - 225px)}}`;
const shell = (body: string, pageStyles = styles) =>
  `<!doctype html><html lang="zh"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t.title}</title><style>${pageStyles}</style></head><body>${body}</body></html>`;

export function previewPage() {
  return shell(
    `<header><h1>${t.title}</h1><p>${t.notice}</p><div class="tools"><label>${t.scenario}<select id="scenario">${scenarioNames.map((name) => `<option value="${name}">${t.scenarios[name]}</option>`).join('')}</select></label><label>${t.theme}<select id="theme"><option value="light">${t.light}</option><option value="dark">${t.dark}</option></select></label><button id="restart">${t.restart}</button><a class="link" id="open" target="_blank" rel="noreferrer">${t.open}</a></div><p style="margin-top:10px">${t.hint}</p></header><iframe id="preview" title="${t.title}"></iframe><script>const scenario=document.querySelector('#scenario');const theme=document.querySelector('#theme');function restart(){const p=new URLSearchParams({redirect:'/__auth-preview/success',previewScenario:scenario.value,previewTheme:theme.value});const src='/login?'+p;document.querySelector('#preview').src=src;document.querySelector('#open').href=src;}document.querySelector('#restart').onclick=restart;scenario.onchange=restart;theme.onchange=restart;restart();</script>`
  );
}

export function successPage() {
  return shell(
    '<div id="root"></div><script type="module" src="/dev/auth-preview/success.tsx"></script>',
    ''
  );
}
