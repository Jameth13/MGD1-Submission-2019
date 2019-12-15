//Cookies
//Local storage: ref - https://blog.logrocket.com/the-complete-guide-to-using-localstorage-in-javascript-apps-ba44edb53a36/
export function SaveCookie(name, data) {
    window.localStorage.setItem(name, data);
}

export function DeleteCookie(name) {
    window.localStorage.removeItem(name);
}

export function LoadCookie(name) {
    return window.localStorage.getItem(name);
}
