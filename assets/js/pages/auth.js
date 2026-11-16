import { $ } from '../modules/utils.js';
import { getCurrentUser, loginLocalAccount, logoutLocalAccount, registerLocalAccount } from '../modules/auth.js';

const page = document.body.dataset.page;
const isRegister = page === 'registro';
const form = $('[data-auth-form]');
const status = $('[data-auth-status]');
const content = $('[data-auth-content]');
const accountPanel = $('[data-account-panel]');
const params = new URLSearchParams(location.search);

function showStatus(message, kind = 'info') {
    if (!status) return;
    status.textContent = message;
    status.dataset.kind = kind;
    status.hidden = false;
}

function addReturnParameter(link) {
    if (!link) return;
    const returnTo = params.get('return');
    if (!returnTo) return;
    const next = new URL(link.href, location.href);
    next.searchParams.set('return', returnTo);
    link.href = next.href;
}

function safeReturnUrl() {
    const value = params.get('return');
    if (!value) return new URL('index.html', location.href).href;
    try {
        const destination = new URL(value, location.href);
        if (destination.origin !== location.origin) return new URL('index.html', location.href).href;
        if (/\/(login|registro)\.html$/.test(destination.pathname)) return new URL('index.html', location.href).href;
        return destination.href;
    } catch {
        return new URL('index.html', location.href).href;
    }
}

function renderAccount() {
    const user = getCurrentUser();
    if (!user || !accountPanel || !content) return false;
    content.hidden = true;
    accountPanel.hidden = false;
    $('[data-account-name]', accountPanel).textContent = user.name || 'jogador';
    $('[data-account-email]', accountPanel).textContent = user.email;
    return true;
}

addReturnParameter($('[data-register-link]'));
addReturnParameter($('[data-login-link]'));

const needsFavoriteLogin = params.get('reason') === 'favorite';
if (needsFavoriteLogin) showStatus('Entre ou crie sua conta para adicionar jogos aos favoritos.');

if (!renderAccount()) {
    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;

        const submit = form.querySelector('[type="submit"]');
        const originalLabel = submit.textContent;
        submit.disabled = true;
        submit.textContent = isRegister ? 'Criando conta…' : 'Entrando…';
        status.hidden = true;

        try {
            const data = new FormData(form);
            if (isRegister) {
                if (data.get('password') !== data.get('confirmPassword')) throw new Error('As senhas não são iguais.');
                await registerLocalAccount({ name: data.get('name'), email: data.get('email'), password: data.get('password') });
            } else {
                await loginLocalAccount({ email: data.get('email'), password: data.get('password') });
            }
            location.assign(safeReturnUrl());
        } catch (error) {
            showStatus(error instanceof Error ? error.message : 'Não foi possível concluir o acesso. Tente novamente.', 'error');
            submit.disabled = false;
            submit.textContent = originalLabel;
        }
    });

    document.querySelectorAll('[data-social]').forEach((button) => {
        button.addEventListener('click', () => {
            const provider = button.dataset.social;
            const names = { google: 'Google', facebook: 'Facebook', x: 'X' };
            showStatus(`O acesso com ${names[provider] || provider} precisa de uma integração OAuth configurada. No Live Server, use o cadastro com e-mail e senha.`, 'error');
        });
    });
}

$('[data-logout]')?.addEventListener('click', () => {
    logoutLocalAccount();
    if (location.pathname.endsWith('/login.html')) location.reload();
    else location.assign('login.html');
});
