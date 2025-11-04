// --- CONSTANTES E GLOBAIS DE SEGURANÇA ---
const isLocalhost =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const API_URL = isLocalhost
    ? 'http://localhost:8080/api'
    : new URL('./api', window.location.href).toString().replace(/\/$/, '');

function buildApiUrl(path) {
    return `${API_URL}${path}`;
}
const SESSION_TIMEOUT_MS = 300000; // 5 minutos (300,000 ms)

let sessionTimer = null;
let isAdmin = false;
let sessionToken = null; // Armazena o token de login do admin

// mockData foi removido. Os dados virão da API.

const elements = {
    input: document.getElementById('ramalInput'),
    button: document.getElementById('searchButton'),
    message: document.getElementById('messageArea'),
    loading: document.getElementById('loadingIndicator'),
    results: document.getElementById('resultsArea'),
    displayRamal: document.getElementById('displayRamal'),
    credentialsList: document.getElementById('credentialsList'),
    adminButton: document.getElementById('adminButton'),
    adminButtonText: document.getElementById('adminButtonText'),
    adminModal: document.getElementById('adminModal'),
    agentPanel: document.getElementById('agentPanel'),
    adminPanel: document.getElementById('adminPanel'),
    mainTitle: document.getElementById('mainTitle'),
    mainSubtitle: document.getElementById('mainSubtitle')
};

// --- Funções de Gestão de Sessão (Timeout) ---

function startSessionTimer() {
    stopSessionTimer(); // Limpa qualquer timer existente
    sessionTimer = setTimeout(() => {
        if (isAdmin) {
            // Desconecta automaticamente se o timer expirar
            isAdmin = false;
            sessionToken = null;
            stopSessionTimer();
            updateAdminUI();
            displayMessage("Sessão administrativa expirada por inatividade (5 minutos). Por favor, faça login novamente.", 'error', 10000); 
        }
    }, SESSION_TIMEOUT_MS);
}

function stopSessionTimer() {
    if (sessionTimer) {
        clearTimeout(sessionTimer);
        sessionTimer = null;
    }
}

function resetSessionTimer() {
    if (isAdmin) {
        // Só reinicia o timer se o usuário estiver logado como admin
        startSessionTimer();
    }
}

// Adiciona listeners para atividade do usuário (reseta o timer)
window.addEventListener('mousemove', resetSessionTimer);
window.addEventListener('keypress', resetSessionTimer);
window.addEventListener('click', resetSessionTimer);


// --- Funções de Admin e UI ---

function toggleAdminModal() {
    if (isAdmin) {
        // Se já for admin, faz logout
        isAdmin = false;
        sessionToken = null;
        stopSessionTimer(); // PARA O TIMER
        updateAdminUI();
        displayMessage("Logout administrativo realizado.", 'info');
    } else {
        // Abre o modal de login
        elements.adminModal.classList.toggle('active');
    }
}

async function handleAdminLogin() {
    const user = document.getElementById('adminUser').value;
    const pass = document.getElementById('adminPass').value;

    try {
        const response = await fetch(buildApiUrl('/login'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: user, password: pass })
        });

        if (!response.ok) {
            throw new Error('Credenciais inválidas.');
        }

        const data = await response.json();

        if (data.token) {
            isAdmin = true;
            sessionToken = data.token; // Armazena o token seguro
            elements.adminModal.classList.remove('active'); // Fecha o modal
            updateAdminUI();
            startSessionTimer(); // INICIA O TIMER
            displayMessage("Login Administrativo realizado com sucesso!", 'success');
        } else {
            displayMessage("Credenciais inválidas.", 'error');
        }
    } catch (error) {
        displayMessage(error.message || "Credenciais inválidas.", 'error');
    }
}

function updateAdminUI() {
    if (isAdmin) {
        // Admin logado
        elements.agentPanel.classList.add('hidden');
        elements.adminPanel.classList.remove('hidden');
        elements.adminButtonText.textContent = 'Logout Admin';
        elements.adminButton.classList.remove('bg-blue-500');
        elements.adminButton.classList.add('bg-red-500');
        elements.mainTitle.textContent = "Painel de Inclusão de Acessos";
        elements.mainSubtitle.textContent = "Adicione novos colaboradores e credenciais. (Sessão: 5 min)";
    } else {
        // Agente ou deslogado
        elements.agentPanel.classList.remove('hidden');
        elements.adminPanel.classList.add('hidden');
        elements.adminButtonText.textContent = 'Login Admin';
        elements.adminButton.classList.remove('bg-red-500');
        elements.adminButton.classList.add('bg-blue-500');
        elements.mainTitle.textContent = "Consulta de Credenciais";
        elements.mainSubtitle.textContent = "Consulte seus logins dos sistemas corporativos.";
        elements.results.classList.add('hidden'); // Limpa resultados anteriores
    }
}

async function addNewAgent() {
    if (!isAdmin || !sessionToken) {
        displayMessage("Acesso negado. Faça login como administrador para adicionar um agente.", 'error');
        return;
    }

    resetSessionTimer(); // Reseta o timer por atividade

    const form = document.getElementById('addAgentForm');
    const newRamal = form.elements['newRamal'].value.trim();
    
    // Validação de senhas (Front-end)
    const newChannelsPass = form.elements['newChannelsPass'].value.trim();
    const newGestaoPass = form.elements['newGestaoPass'].value.trim();
    const newBlipPass = form.elements['newBlipPass'].value.trim();

    if (newChannelsPass !== newGestaoPass || newChannelsPass !== newBlipPass) {
        displayMessage("ERRO: As senhas dos sistemas Channels, Gestão e Blip devem ser as mesmas.", 'error');
        return;
    }

    // --- ATUALIZADO AQUI: ---
    // Os nomes das chaves (ex: "Gestão (Usuário)") agora correspondem
    // exatamente aos nomes das colunas do seu Airtable.
    const newAgentData = {
        "Ramal": Number(newRamal), // Converte para número se o tipo no Airtable for Number
        "Nome": form.elements['newName'].value.trim(),
        "Channels (Usuário)": form.elements['newChannelsUser'].value.trim(),
        "Gestão (Usuário)": form.elements['newGestaoUser'].value.trim(),
        "Blip (Usuário)": form.elements['newBlipUser'].value.trim(),
        "Email": form.elements['newEmail'].value.trim(),
        "Senha (Unificada)": newChannelsPass // Senha única
    };

    try {
        const response = await fetch(buildApiUrl('/addAgent'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}` // Envia o token de admin
            },
            body: JSON.stringify(newAgentData) // Envia o objeto com os nomes exatos
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erro ao adicionar agente.');
        }

        // Feedback de sucesso (o pop-up)
        displayMessage(`SUCESSO! O Agente ${newAgentData.Nome} (Ramal ${newAgentData.Ramal}) foi adicionado ao sistema.`, 'success');
        form.reset();
        document.getElementById('mainTitle').scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
        displayMessage(`ERRO: ${error.message}`, 'error');
    }
}


// --- Funções Comuns (Agente) ---

async function fetchCredentials(ramal) {
    // Esta função agora chama a API segura
    try {
        // A API (Endpoint 2) deve retornar o JSON com os nomes exatos do Airtable
        const response = await fetch(`${buildApiUrl('/getAgent')}?ramal=${encodeURIComponent(ramal)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                return null; // Ramal não encontrado
            }
            throw new Error('Erro ao buscar dados.');
        }
        
        const data = await response.json();
        return data; // Retorna o JSON com os nomes exatos (ex: data["Gestão (Usuário)"])

    } catch (error) {
        console.error("Erro na API:", error);
        throw error; // Repassa o erro para a função searchRamal
    }
}

/**
 * Lida com a exibição de mensagens (sucesso ou erro), com duração opcional.
 */
function displayMessage(message, type = 'info', duration = 5000) {
    elements.message.textContent = message;
    elements.message.className = 'p-3 mb-6 rounded-lg font-medium transition-all duration-300';
    elements.message.classList.remove('hidden');

    // Ajusta as cores
    switch (type) {
        case 'error':
            elements.message.classList.add('bg-red-100/80', 'text-red-800', 'shadow-md', 'border', 'border-red-300');
            break;
        case 'success':
            elements.message.classList.add('bg-green-100/80', 'text-green-800', 'shadow-md', 'border', 'border-green-300');
            break;
        case 'info':
        default:
            elements.message.classList.add('bg-blue-100/80', 'text-blue-800', 'shadow-md', 'border', 'border-blue-300');
            break;
    }
    
    // Auto-hide message
    setTimeout(() => {
        elements.message.classList.add('hidden');
    }, duration);
}

/**
 * Função principal de busca (Agente).
 */
async function searchRamal() {
    const ramal = elements.input.value.trim();

    // Limpa
    elements.results.classList.add('hidden');
    elements.message.classList.add('hidden');
    elements.credentialsList.innerHTML = '';
    
    if (!ramal) {
        displayMessage("Por favor, digite um número de Ramal.", 'error');
        return;
    }
    
    if (isAdmin) {
        displayMessage("Faça logout do modo Admin para usar a busca de Agente.", 'info');
        return;
    }

    // Carregando
    elements.loading.classList.remove('hidden');
    elements.button.disabled = true;
    elements.button.textContent = 'Buscando...';

    try {
        const agentData = await fetchCredentials(ramal);

        if (agentData) {
            elements.displayRamal.textContent = ramal;
            displayCredentials(agentData);
            elements.results.classList.remove('hidden');
            // --- ATUALIZADO AQUI: ---
            // Exibe o nome do agente (que vem da chave "Nome")
            displayMessage(`Acessos encontrados para ${agentData["Nome"]}.`, 'success'); 
        } else {
            displayMessage(`Ramal ${ramal} não encontrado ou inativo. Verifique o número e tente novamente.`, 'error');
        }
    } catch (error) {
        console.error("Erro ao buscar dados:", error);
        displayMessage("Ocorreu um erro na comunicação com o servidor. Tente novamente mais tarde.", 'error');
    } finally {
        // Reset
        elements.loading.classList.add('hidden');
        elements.button.disabled = false;
        elements.button.textContent = 'Buscar Acessos';
    }
}

/**
 * Cria e exibe os cards de credenciais.
 */
function displayCredentials(data) {
    // --- ATUALIZADO AQUI: ---
    // Os nomes das chaves (ex: "Gestão (Usuário)") agora correspondem
    // exatamente aos nomes das colunas do seu Airtable.
    const credentials = [
        { title: "Channels (Usuário)", value: data["Channels (Usuário)"], icon: "👤" },
        { title: "Channels (Senha)", value: data["Senha (Unificada)"], icon: "🔑" },
        { title: "Gestão (Usuário)", value: data["Gestão (Usuário)"], icon: "⚙️" },
        { title: "Gestão (Senha)", value: data["Senha (Unificada)"], icon: "🔑" },
        { title: "Blip (Usuário)", value: data["Blip (Usuário)"], icon: "💬" },
        { title: "Blip (Senha)", value: data["Senha (Unificada)"], icon: "🔑" },
        { title: "E-mail Corporativo", value: data["Email"], icon: "📧" },
    ];
    
    elements.credentialsList.innerHTML = credentials.map(item => `
        <div class="p-4 bg-gray-50 rounded-lg shadow-md hover:bg-gray-100 transition-colors duration-200 border border-gray-200">
            <p class="text-sm font-semibold text-gray-500 flex items-center mb-1">
                ${item.icon} <span class="ml-2">${item.title}</span>
            </p>
            <div class="flex justify-between items-center mt-1">
                <span class="text-gray-900 text-lg font-mono break-all">${item.value || 'N/D'}</span>
                <button 
                    onclick="copyToClipboard('${item.value || ''}', this)" 
                    class="ml-3 px-3 py-1 text-xs bg-blue-600 text-white hover:bg-blue-700 rounded-full transition-colors duration-200 shadow-md flex-shrink-0"
                    title="Copiar"
                >
                    Copiar
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Copia texto para a área de transferência.
 */
function copyToClipboard(text, button) {
    if (!text) return; // Não copia se o valor for nulo/vazio
    
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed'; 
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            const originalText = button.textContent;
            button.textContent = 'Copiado!';
            button.classList.remove('bg-blue-600');
            button.classList.add('bg-green-600');
            
            setTimeout(() => {
                button.textContent = originalText;
                button.classList.remove('bg-green-600');
                button.classList.add('bg-blue-600');
            }, 1500);
        } else {
            displayMessage('Erro ao copiar. Tente selecionar manualmente.', 'error');
        }
    } catch (err) {
        console.error('Falha ao copiar:', err);
        displayMessage('Erro ao copiar. Tente selecionar manualmente.', 'error');
    }
    
    document.body.removeChild(textarea);
}

// Inicializa a UI ao carregar
document.addEventListener('DOMContentLoaded', updateAdminUI);

// Habilita a busca ao pressionar ENTER no campo de ramal
elements.input.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchRamal();
    }
});