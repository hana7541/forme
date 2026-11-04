// 화면이 그려지기 전에 실행되는 아주 짧은 스크립트 (서버 레이아웃에서 <head>에 넣음)
// - 테마: 저장된 라이트/다크/시스템 → <html data-theme>
// - 언어: 저장된 KR/EN → <html lang>
// "use client" 파일이 아니어야 서버에서 문자열로 읽을 수 있어요.

export const THEME_KEY = "forme-theme";
export const LANG_KEY = "forme-lang";

export const themeScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}')||'light';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}})();`;

export const langScript = `(function(){try{document.documentElement.lang=localStorage.getItem('${LANG_KEY}')==='en'?'en':'ko'}catch(e){}})();`;
