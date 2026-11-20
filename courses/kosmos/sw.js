/* Сервис-воркер курса "Космический курс · Олимпиадная математика, 4 класс": раздаёт расшифрованные файлы из кэша.
   Генерируется автоматически (uroki-tools/pw), вручную не редактировать. */
"use strict";
const CACHE = "course-kosmos";
const FILES = new Set(["m01.html","m02.html","m03.html","m04.html","m05.html","m06.html","start.html"]);
const scopePath = new URL(self.registration.scope).pathname;
let code = null;
let lastCheck = 0;

/* --- мини-IndexedDB для хранения кода между перезапусками воркера --- */
let idbP = null;
const idb = () => idbP || (idbP = new Promise((res, rej) => {
  const r = indexedDB.open("pw-sw-" + "kosmos", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("kv");
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
}));
async function idbGet(k) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction("kv").objectStore("kv").get(k); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); }
async function idbSet(k, v) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); }

/* --- помощники --- */
function hexBytes(h) { const a = new Uint8Array(h.length / 2); for (let i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }
function b64Bytes(b) { const s = atob(b); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
const enc = new TextEncoder();

/* проверка кода по лицензиям; при ошибке сети считаем код действительным */
async function codeValid(codeNow) {
  try {
    const r = await fetch("licenses.json", { cache: "no-store" });
    const { licenses } = await r.json();
    const km = await crypto.subtle.importKey("raw", enc.encode(codeNow), "PBKDF2", false, ["deriveKey"]);
    for (const lic of licenses) {
      try {
        const key = await crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: hexBytes(lic.salt), iterations: lic.iterations || 200000, hash: "SHA-256" },
          km, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
        const raw = b64Bytes(lic.wrap);
        await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, key, raw.slice(12));
        return true;
      } catch (e) { /* следующая лицензия */ }
    }
    return false;
  } catch (e) { return true; }
}

self.addEventListener("install", e => self.skipWaiting());

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    code = (await idbGet("code")) || null;
    await self.clients.claim();
  })());
});

self.addEventListener("message", e => {
  if (e.data && e.data.type === "code" && e.data.code) {
    code = e.data.code;
    e.waitUntil(idbSet("code", code));
  }
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  const rel = url.pathname.slice(scopePath.length);
  if (!FILES.has(rel)) return;
  e.respondWith((async () => {
    /* на открытиях страниц курса раз в час перепроверяем код: отозванный доступ теряет кэш */
    if (e.request.mode === "navigate" && code && Date.now() - lastCheck > 3600e3) {
      lastCheck = Date.now();
      if (!(await codeValid(code))) {
        await caches.delete(CACHE);
        return Response.redirect(scopePath, 302);
      }
    }
    const cache = await caches.open(CACHE);
    const hit = await cache.match(url.origin + scopePath + rel);
    if (hit) return hit;
    return fetch(e.request);
  })());
});
