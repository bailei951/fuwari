// scripts/encrypt-tool.mjs
//
// 把受保护工具页的「完整原始 HTML」用 AES-GCM-256 加密为 content.enc，
// 并把 index.html 替换为极简外壳 + 内联解密器。
//
// 用法：
//   node scripts/encrypt-tool.mjs <pageDir> [password] [--verify]
//
//   <pageDir>   受保护页面目录（含 index.html），如 public/tools/zhuanshengben
//   password    访问密钥明文（默认读 env GATE_PASSWORD，再默认 "鳄鱼"）
//   --verify    只校验：解密 content.enc 与当前 index.html 剥离 gate 后是否一致
//
// 安全：
//   - 密钥仅用于本地 PBKDF2 派生，绝不写入任何文件
//   - 仓库只存 content.enc（base64(salt[16] || iv[12] || ciphertext)）与外壳
//   - 错密钥由 AES-GCM 认证标签拦截（解密抛异常）
//
// 依赖：Node ≥ 18（globalThis.crypto.subtle，Web Crypto）

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ITERATIONS = 250_000
const SALT_LEN = 16
const IV_LEN = 12

// ---------- 参数 ----------
const args = process.argv.slice(2)
const verifyOnly = args.includes('--verify')
const positional = args.filter((a) => !a.startsWith('--'))
const pageDir = positional[0]
const password = positional[1] ?? process.env.GATE_PASSWORD ?? '鳄鱼'

if (!pageDir) {
  console.error('用法: node scripts/encrypt-tool.mjs <pageDir> [password] [--verify]')
  process.exit(1)
}

const indexPath = join(pageDir, 'index.html')
const encPath = join(pageDir, 'content.enc')
const dirName = pageDir.replace(/\/+$/, '').split('/').pop()
const sessionKey = `_gpw_${dirName}`

// ============================================================
// Web Crypto 工具
// ============================================================
const subtle = globalThis.crypto.subtle

function bytesToBase64(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}
function base64ToBytes(b64) {
  const bin = atob(b64.trim())
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

async function deriveKey(pwd, salt) {
  const keyMaterial = await subtle.importKey(
    'raw',
    new TextEncoder().encode(pwd),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encryptString(plaintext, pwd) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN))
  const key = await deriveKey(pwd, salt)
  const ct = new Uint8Array(
    await subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)),
  )
  const out = new Uint8Array(SALT_LEN + IV_LEN + ct.length)
  out.set(salt, 0)
  out.set(iv, SALT_LEN)
  out.set(ct, SALT_LEN + IV_LEN)
  return bytesToBase64(out)
}

async function decryptTostring(b64, pwd) {
  const bytes = base64ToBytes(b64)
  const salt = bytes.slice(0, SALT_LEN)
  const iv = bytes.slice(SALT_LEN, SALT_LEN + IV_LEN)
  const ct = bytes.slice(SALT_LEN + IV_LEN)
  const key = await deriveKey(pwd, salt)
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return new TextDecoder().decode(pt)
}

// ============================================================
// gate 剥离：从含 gate 的 index.html 还原「原始整页 HTML」
// ============================================================
// gate 块 = <div id="pw-gate">…</div></div> + 紧随的 <script>…checkGate…</script>
const GATE_RE = /<div id="pw-gate"[\s\S]*?<\/script>\s*/i

function stripGate(html) {
  const m = html.match(GATE_RE)
  if (!m) {
    throw new Error('未找到 #pw-gate 块——该页面可能未启用旧 gate，或已被加密外壳替换。')
  }
  return html.replace(GATE_RE, '')
}

function extractTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i)
  return m ? m[1].trim() : '访问受限'
}

// 外壳用通用标题，鉴权前不泄露页面主题（解密后整页替换会还原真实 <title>）
const SHELL_TITLE = '内容受保护 · 请输入密钥'

// ============================================================
// 外壳模板
// ============================================================
function shellTemplate() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>${SHELL_TITLE}</title>
<link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32.png?v=2">
<style>
  html,body{margin:0;height:100%}
  #pw-gate{position:fixed;inset:0;z-index:99999;background:#f8f9fb;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;-webkit-user-select:none;user-select:none}
  #pw-gate .box{text-align:center;max-width:380px;width:calc(100% - 40px);padding:40px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);box-sizing:border-box}
  #pw-gate .emoji{font-size:3rem;margin-bottom:16px}
  #pw-gate h2{margin:0 0 8px;color:#1a1a2e;font-size:1.3rem}
  #pw-gate p{color:#8b8b9e;font-size:.9rem;margin:0 0 24px}
  #pw-gate input{width:100%;padding:12px 16px;border:2px solid #e4e4e7;border-radius:10px;font-size:1rem;outline:none;box-sizing:border-box;text-align:center;-webkit-text-security:disc;text-security:disc}
  #pw-gate input:focus{border-color:#6366f1}
  #pw-gate #pw-error{color:#ef4444;font-size:.8rem;margin-top:8px;display:none}
  #pw-gate button{width:100%;margin-top:16px;padding:12px;background:#6366f1;color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:600;cursor:pointer}
  #pw-gate button:disabled{opacity:.6;cursor:default}
</style>
</head>
<body>
<div id="pw-gate">
  <div class="box">
    <div class="emoji">🔐</div>
    <h2>访问受限</h2>
    <p>请输入访问密钥以继续</p>
    <input id="pw-input" type="text" placeholder="请输入密钥" inputmode="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" autofocus>
    <div id="pw-error">密钥错误，请重试</div>
    <button id="pw-btn" type="button">确认</button>
  </div>
</div>
<script>
(function(){
  "use strict";
  var ENC_URL="content.enc",ITER=${ITERATIONS},KEY="${sessionKey}";
  // 鉴权前轻量加固：禁右键 / 禁选择（解密后整页替换，授权用户不受影响）
  document.addEventListener("contextmenu",function(e){e.preventDefault();});
  document.addEventListener("selectstart",function(e){if(e.target.tagName!=="INPUT")e.preventDefault();});
  document.addEventListener("dragstart",function(e){e.preventDefault();});
  try{console.log("%c⚠ 内容受 AES-GCM 加密保护","color:#ef4444;font-size:16px;font-weight:bold");}catch(e){}

  function $(id){return document.getElementById(id);}
  function showError(msg){
    var el=$("pw-error");if(el){el.textContent=msg;el.style.display="block";}
    var btn=$("pw-btn");if(btn){btn.disabled=false;btn.textContent="确认";}
    var inp=$("pw-input");if(inp){inp.value="";inp.focus();}
  }
  function setLoading(){
    var btn=$("pw-btn");if(btn){btn.disabled=true;btn.textContent="解密中…";}
  }
  function b64ToBytes(b64){
    var bin=atob(b64),arr=new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
    return arr;
  }
  function deriveKey(pwd,salt){
    return crypto.subtle.importKey("raw",new TextEncoder().encode(pwd),"PBKDF2",false,["deriveKey"]).then(function(km){
      return crypto.subtle.deriveKey({name:"PBKDF2",salt:salt,iterations:ITER,hash:"SHA-256"},km,{name:"AES-GCM",length:256},false,["decrypt"]);
    });
  }
  function unlock(pwd){
    setLoading();
    fetch(ENC_URL,{cache:"no-store"}).then(function(r){
      if(!r.ok)throw new Error("密文加载失败 ("+r.status+")");
      return r.text();
    }).then(function(b64){
      var bytes=b64ToBytes(b64.trim());
      var salt=bytes.slice(0,${SALT_LEN}),iv=bytes.slice(${SALT_LEN},${SALT_LEN + IV_LEN}),ct=bytes.slice(${SALT_LEN + IV_LEN});
      return deriveKey(pwd,salt).then(function(key){
        return crypto.subtle.decrypt({name:"AES-GCM",iv:iv},key,ct);
      }).then(function(pt){
        var html=new TextDecoder().decode(pt);
        try{sessionStorage.setItem(KEY,pwd);}catch(e){}
        // 用整页 HTML 替换文档：脚本重新执行、DOMContentLoaded 自然触发，行为同原页
        document.open();document.write(html);document.close();
      });
    }).catch(function(){
      try{sessionStorage.removeItem(KEY);}catch(e){}
      showError("密钥错误，请重试");
    });
  }
  function submit(){var v=$("pw-input").value;if(v)unlock(v);}
  $("pw-btn").addEventListener("click",submit);
  $("pw-input").addEventListener("keydown",function(e){if(e.key==="Enter")submit();});
  // 会话内免重输
  try{var cached=sessionStorage.getItem(KEY);if(cached)unlock(cached);}catch(e){}
})();
</script>
</body>
</html>
`
}

// ============================================================
// 主流程
// ============================================================
async function main() {
  if (!existsSync(indexPath)) {
    console.error(`[encrypt-tool] 找不到 ${indexPath}`)
    process.exit(1)
  }
  const original = readFileSync(indexPath, 'utf8')

  // 已是外壳（无 gate）时，--verify 仍可对 content.enc 做解密校验
  const hasGate = /<div id="pw-gate"[\s\S]*?checkGate/i.test(original)

  if (verifyOnly) {
    if (!existsSync(encPath)) {
      console.error(`[encrypt-tool] 找不到 ${encPath}，无法校验`)
      process.exit(1)
    }
    const enc = readFileSync(encPath, 'utf8')
    // 解密失败（错密钥/密文损坏）会抛异常 → 视为校验失败
    const decrypted = await decryptTostring(enc, password)
    const recTitle = extractTitle(decrypted)
    const valid = /<html[\s>]/i.test(decrypted) && /<\/html>\s*$/i.test(decrypted.trim())
    if (!valid) {
      console.error(`[encrypt-tool] ❌ 校验失败：解密成功但内容非完整 HTML 文档`)
      process.exit(1)
    }
    console.log(`[encrypt-tool] ✅ 校验通过：${pageDir}`)
    console.log(`  密文可解密，明文长度=${decrypted.length} 字节，恢复标题="${recTitle}"`)
    return
}

  if (!hasGate) {
    console.error(`[encrypt-tool] ${indexPath} 未发现旧 gate 块，跳过（可能已加密）。如需重加密请先恢复含 gate 的原始页面。`)
    process.exit(1)
  }

  const cleanHtml = stripGate(original)
  const title = extractTitle(original)
  const enc = await encryptString(cleanHtml, password)

  writeFileSync(encPath, enc, 'utf8')
  writeFileSync(indexPath, shellTemplate(), 'utf8')

  // 即时自检
  const reread = readFileSync(encPath, 'utf8')
  const decrypted = await decryptTostring(reread, password)
  if (decrypted !== cleanHtml) {
    console.error(`[encrypt-tool] ❌ 自检失败：回读解密不一致`)
    process.exit(1)
  }
  console.log(`[encrypt-tool] ✅ 加密完成：${pageDir}`)
  console.log(`  title  : ${title}`)
  console.log(`  enc    : ${encPath} (${enc.length} 字符 base64)`)
  console.log(`  shell  : ${indexPath} (${cleanHtml.length} 字节明文已移出源码)`)
  console.log(`  session: ${sessionKey}`)
}

main().catch((err) => {
  console.error('[encrypt-tool] 错误:', err.message)
  process.exit(1)
})
