document.addEventListener('DOMContentLoaded', () => {

    // =========================================================
    // === 0. VARIÁVEIS DO MODAL ===
    // =========================================================
    const alertaModal = document.getElementById('meuAlerta');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalIcon = document.getElementById('modal-icon');
    const modalActions = document.getElementById('modal-actions');
    
    // Variável temporária para ações de confirmação/redirecionamento
    let acaoConfirmacao; 

    // =========================================================
    // === FUNÇÕES DE ALERTA MODAL ===
    // =========================================================

    /**
     * Exibe o alerta modal personalizado.
     * @param {string} titulo - Título do alerta.
     * @param {string} mensagem - Mensagem detalhada (pode conter tags HTML como <b>).
     * @param {string} icone - Nome do ícone do Material Icons.
     * @param {string} [botoesHTML] - HTML dos botões de ação (opcional).
     */
    function mostrarAlerta(titulo, mensagem, icone, botoesHTML) {
        modalTitle.textContent = titulo;
        modalIcon.textContent = icone;
        modalMessage.innerHTML = mensagem; // Usa innerHTML para processar <b>
        
        if (botoesHTML) {
            modalActions.innerHTML = botoesHTML;
        } else {
            modalActions.innerHTML = `<button class="btn primary-btn" onclick="fecharAlerta()">OK</button>`;
        }
        
        alertaModal.classList.add('active');
    }

    /**
     * Fecha o alerta modal e executa a ação de confirmação pendente.
     */
    window.fecharAlerta = function() {
        alertaModal.classList.remove('active');
        
        if (typeof acaoConfirmacao === 'function') {
            acaoConfirmacao();
            acaoConfirmacao = null; // Limpa após execução
        }
    };


    // =========================================================
    // === 1. Variáveis de Estado (Pedidos Persistem, Preços Fixos) ===
    // =========================================================
    
    // Membros pré-salvos por Família
    const membrosIniciaisPorFamilia = {
        'Kelvin': ['Kelvin', 'Elaine', 'Livia', 'Levi'],
        'Matheus': ['Matheus', 'Greice', 'Abner'],
        'Moisés': ['Moisés', 'Ana'],
        'Santos': ['Santos', 'Joselia']
    };

    // Dados iniciais (Estoque e Preços FIXOS no código)
    const initialEstoque = [
        { sabor: 'Bacon com requeijão', preco: 4.50 },
        { sabor: 'Bacon com mussarela', preco: 4.30 },
        { sabor: 'Carne', preco: 3.50 },
        { sabor: 'Queijo', preco: 3.90 },
        { sabor: 'Atum com mussarela', preco: 4.80 },
        { sabor: 'Frango com mussarela', preco: 4.20 },
        { sabor: 'Frango com requeijão', preco: 4.50 },
        { sabor: 'Mussarela', preco: 3.90 },
    ];
    
    // --- Lógica de Inicialização ---
    
    let estoque = initialEstoque; 
    let pedidoGeral = JSON.parse(localStorage.getItem('esfirrasPedidoGeral')) || {};
    
    let membroEmEdicao = null; 

    // === 2. Seletores de Elementos ===
    const navLinks = document.querySelectorAll('.mobile-nav .nav-item');
    const pageSections = document.querySelectorAll('.page-section');
    
    // Membro/Família Selectors
    const selectFamilia = document.getElementById('select-familia');
    const membrosContainer = document.getElementById('membros-container'); 
    const membrosNoPedidoUl = document.getElementById('clientes-no-pedido'); 
    
    // Estoque Editor Selectors
    const estoqueEditorDiv = document.getElementById('estoque-editor');
    const salvarPrecosBtn = document.getElementById('salvarPrecosBtn');
    const addSaborBtn = document.getElementById('addSaborBtn');
    
    // Pedido Selectors
    const pedidoMembroTitle = document.getElementById('pedido-cliente-title'); 
    const estoqueList = document.getElementById('estoque-list');
    const salvarPedidoBtn = document.getElementById('salvarPedidoBtn');
    
    // Resumo Selectors
    const resumoTotalContainer = document.getElementById('resumo-total-container');
    const gerarPdfBtn = document.getElementById('gerarPdfBtn');

    // === 3. Funções de Utilidade e Navegação ===

    function saveState() {
        localStorage.setItem('esfirrasPedidoGeral', JSON.stringify(pedidoGeral));
    }

    function goToPage(pageId) {
        pageSections.forEach(section => section.style.display = 'none');
        navLinks.forEach(link => link.classList.remove('active'));

        const targetSection = document.getElementById(pageId);
        if (targetSection) targetSection.style.display = 'block';

        const targetLink = document.querySelector(`.mobile-nav .nav-item[data-page="${pageId}"]`);
        if (targetLink) targetLink.classList.add('active');

        // Ações específicas ao mudar de página
        if (pageId === 'clientes-mobile') {
            renderMembrosNoPedido(); 
            renderMembrosBotoes(selectFamilia.value); 
        } else if (pageId === 'estoque-mobile') {
            renderEstoqueEditor();
        } else if (pageId === 'resumo-mobile') {
            renderResumoTotal();
        }
    }

    // Navegação via menu de rodapé
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.getAttribute('data-page');
            goToPage(pageId);
        });
    });

    // === 4. Lógica da Seção de Membros (Seleção Rápida por Botão) ===

    selectFamilia.addEventListener('change', (e) => {
        const familia = e.target.value;
        renderMembrosBotoes(familia);
    });

    function renderMembrosBotoes(familia) {
        membrosContainer.innerHTML = ''; 
        
        if (!familia) {
            membrosContainer.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Selecione uma família acima.</p>';
            return;
        }

        const membros = membrosIniciaisPorFamilia[familia];
        
        if (membros) {
            membros.forEach(membro => {
                const button = document.createElement('button');
                button.classList.add('membro-btn');
                
                // Marca como ativo se tiver um pedido salvo (mesmo que vazio)
                const isActive = pedidoGeral[familia] && pedidoGeral[familia][membro];

                button.textContent = membro;
                button.dataset.familia = familia;
                button.dataset.membro = membro; 
                
                button.addEventListener('click', (e) => {
                    const f = e.currentTarget.dataset.familia;
                    const m = e.currentTarget.dataset.membro; 
                    
                    // Inicializa a estrutura do membro se não existir
                    if (!pedidoGeral[f]) pedidoGeral[f] = {};
                    if (!pedidoGeral[f][m]) {
                        pedidoGeral[f][m] = { itens: {} };
                        saveState(); 
                    }
                    startPedido(f, m);
                });

                membrosContainer.appendChild(button);
            });
        }
    }


    function renderMembrosNoPedido() {
        membrosNoPedidoUl.innerHTML = ''; 
        let hasActiveMembros = false;

        const familiasOrdenadas = Object.keys(pedidoGeral).sort();

        familiasOrdenadas.forEach(familia => {
            const membrosOrdenados = Object.keys(pedidoGeral[familia]).sort(); 
            
            membrosOrdenados.forEach(membro => {
                let totalEsfirras = 0;
                const itens = pedidoGeral[familia][membro]?.itens;

                if (itens) {
                   for (const sabor in itens) {
                        totalEsfirras += itens[sabor];
                   }
                }
                
                // Exibe APENAS se o membro tiver feito pelo menos 1 esfirra
                if (totalEsfirras > 0) {
                    const li = document.createElement('li');
                    
                    li.innerHTML = `
                        <div>
                            <strong>${membro}</strong> (Família: ${familia}) 
                            <small>| ${totalEsfirras} Esfirras</small>
                        </div>
                        <div>
                            <button class="btn-edit" data-familia="${familia}" data-membro="${membro}">
                                <span class="material-icons">edit</span>
                            </button>
                            <button class="btn-delete" data-familia="${familia}" data-membro="${membro}">
                                <span class="material-icons">delete</span>
                            </button>
                        </div>
                    `;
                    membrosNoPedidoUl.appendChild(li); 
                    hasActiveMembros = true;
                }
            });
        });

        if (!hasActiveMembros) {
            membrosNoPedidoUl.innerHTML = '<li style="color: var(--text-secondary);">Nenhum Membro com pedido ativo.</li>'; 
            gerarPdfBtn.disabled = true;
        } else {
            gerarPdfBtn.disabled = false;
        }
        
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => startPedido(e.currentTarget.dataset.familia, e.currentTarget.dataset.membro)); 
        });
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => deleteMembroPedidoConfirm(e.currentTarget.dataset.familia, e.currentTarget.dataset.membro)); 
        });
    }
    
    /**
     * Usa alerta modal sem asteriscos.
     */
    function deleteMembroPedidoConfirm(familia, membro) {
        acaoConfirmacao = () => deleteMembroPedido(familia, membro);
        
        const botoesHTML = `
            <button class="btn danger-btn" onclick="fecharAlerta()">Confirmar Limpeza</button>
            <button class="btn secondary-btn" onclick="acaoConfirmacao = null; fecharAlerta()">Cancelar</button>
        `;
        
        mostrarAlerta(
            "Limpar Pedido",
            `Tem certeza que deseja <b>LIMPAR (remover todas as esfirras)</b> do pedido de <b>${membro}</b> da Família <b>${familia}</b>?`,
            "delete_forever",
            botoesHTML
        );
    }

    function deleteMembroPedido(familia, membro) {
        // Limpa o pedido (volta para itens: {})
        pedidoGeral[familia][membro].itens = {}; 
        
        // Verifica se este membro está na lista inicial da família.
        const isMembroInicial = membrosIniciaisPorFamilia[familia] && membrosIniciaisPorFamilia[familia].includes(membro);
        
        if (!isMembroInicial) {
             delete pedidoGeral[familia][membro];
        }
        
        // Remove a família do pedidoGeral se não houver mais membros nela
        if (Object.keys(pedidoGeral[familia]).length === 0) {
            delete pedidoGeral[familia];
        }
        
        saveState(); 
        renderMembrosNoPedido(); 
        mostrarAlerta("Pedido Limpo!", `O pedido de ${membro} foi <b>limpo</b> com sucesso.`, "check_circle");
    }
    
    // === 5. Lógica da Edição de Estoque (Preços) ===

    function renderEstoqueEditor() {
        estoqueEditorDiv.innerHTML = `
            <h2>⚠️ Atenção: Preços FIXOS</h2>
            <p>Os preços são fixos no código e não podem ser salvos permanentemente aqui. As alterações feitas <b>serão perdidas ao recarregar</b>.</p>
            <table>
                <thead>
                    <tr><th>Sabor</th><th>Preço (R$)</th><th>Ações</th></tr>
                </thead>
                <tbody id="estoque-table-body">
                </tbody>
            </table>
        `;
        const tbody = document.getElementById('estoque-table-body');
        
        estoque.forEach((item, index) => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td><input type="text" class="input-sabor" value="${item.sabor}" data-index="${index}"></td>
                <td><input type="number" step="0.01" class="input-preco" value="${item.preco.toFixed(2)}" data-index="${index}"></td>
                <td><button class="btn-remove-sabor" data-index="${index}"><span class="material-icons">delete</span></button></td>
            `;
        });
        
        document.querySelectorAll('.btn-remove-sabor').forEach(btn => {
            btn.addEventListener('click', (e) => removeSaborConfirm(parseInt(e.currentTarget.dataset.index)));
        });
    }
    
    /**
     * Usa alerta modal sem asteriscos.
     */
    function removeSaborConfirm(index) {
        const sabor = estoque[index].sabor;
        acaoConfirmacao = () => removeSabor(index);

        const botoesHTML = `
            <button class="btn danger-btn" onclick="fecharAlerta()">Confirmar Remoção</button>
            <button class="btn secondary-btn" onclick="acaoConfirmacao = null; fecharAlerta()">Cancelar</button>
        `;
        
        mostrarAlerta(
            "Remover Sabor",
            `Tem certeza que deseja remover o sabor <b>${sabor}</b>? Lembre-se, a remoção será perdida ao recarregar a página.`,
            "error_outline",
            botoesHTML
        );
    }

    function removeSabor(index) {
        estoque.splice(index, 1);
        renderEstoqueEditor();
        mostrarAlerta("Sucesso", "Sabor removido da lista (Temporariamente).", "check_circle");
    }
    
    addSaborBtn.addEventListener('click', () => {
        estoque.push({ sabor: 'Novo Sabor', preco: 0.00 });
        renderEstoqueEditor();
        mostrarAlerta("Novo Sabor", "Sabor 'Novo Sabor' adicionado. Edite o nome e preço na tabela.", "info");
    });

    /**
     * Usa alerta modal sem asteriscos.
     */
    salvarPrecosBtn.addEventListener('click', () => {
        const newEstoque = [];
        let valid = true;
        
        document.querySelectorAll('#estoque-table-body tr').forEach(row => {
            const saborInput = row.querySelector('.input-sabor');
            const precoInput = row.querySelector('.input-preco');
            
            const sabor = saborInput.value.trim();
            const preco = parseFloat(precoInput.value);

            if (!sabor || isNaN(preco) || preco < 0) {
                valid = false;
                saborInput.style.border = '1px solid var(--danger-color)';
                precoInput.style.border = '1px solid var(--danger-color)';
                return;
            } else {
                saborInput.style.border = '1px solid var(--border-color)';
                precoInput.style.border = '1px solid var(--border-color)';
            }

            newEstoque.push({ sabor, preco });
        });

        if (valid) {
            estoque = newEstoque; 
            mostrarAlerta("Sucesso!", "Tabela de preços atualizada com sucesso (Apenas para esta sessão).", "check_circle");
        } else {
            mostrarAlerta("Erro de Preenchimento", "Por favor, preencha todos os campos <b>Sabor</b> e <b>Preço</b> corretamente.", "warning");
        }
    });

    // === 6. Lógica da Montagem do Pedido (Por Membro) ===

    function startPedido(familia, membro) { 
        membroEmEdicao = { familia, membro }; 
        pedidoMembroTitle.textContent = `Pedido de ${membro} (Família ${familia})`; 
        
        const pedidoMembro = pedidoGeral[familia][membro]?.itens || {}; 

        estoqueList.innerHTML = '';
        
        estoque.forEach(item => {
            const currentQty = pedidoMembro[item.sabor] || 0; 
            
            // NOVO HTML: Estrutura compacta
            const itemHtml = `
                <div class="esfirra-item" data-sabor="${item.sabor}" data-preco="${item.preco.toFixed(2)}">
                    <div class="item-info">
                        <h4>${item.sabor}</h4>
                        <p>R$ ${item.preco.toFixed(2)}</p>
                    </div>
                    <div class="quantity-controls">
                        <button class="qty-btn minus-btn"><span class="material-icons">remove</span></button>
                        <input type="number" class="qty-input" value="${currentQty}" min="0" readonly>
                        <button class="qty-btn plus-btn"><span class="material-icons">add</span></button>
                    </div>
                </div>
            `;
            // FIM NOVO HTML
            estoqueList.insertAdjacentHTML('beforeend', itemHtml);
        });
        
        salvarPedidoBtn.disabled = false;
        goToPage('pedido-mobile');
    }
    
    // Adiciona listeners para os botões de + e -
    estoqueList.addEventListener('click', (e) => {
        if (!membroEmEdicao) return; 
        
        const itemElement = e.target.closest('.esfirra-item');
        if (!itemElement) return;

        // Garante que o clique foi em um botão
        const isButton = e.target.closest('.qty-btn');
        if (!isButton) return;

        const input = itemElement.querySelector('.qty-input');
        let currentQty = parseInt(input.value);

        if (isButton.classList.contains('plus-btn')) {
            currentQty++;
        } else if (isButton.classList.contains('minus-btn')) {
            currentQty = Math.max(0, currentQty - 1);
        } else {
            return;
        }

        input.value = currentQty;
    });
    
    // BOTÃO DE FINALIZAÇÃO DO MEMBRO
    /**
     * Usa alerta modal sem asteriscos e com <b>.
     */
    salvarPedidoBtn.addEventListener('click', () => {
        if (!membroEmEdicao) return; 
        
        const { familia, membro } = membroEmEdicao; 
        const novoPedidoItens = {};
        let totalEsfirrasSalvas = 0;
        
        estoqueList.querySelectorAll('.esfirra-item').forEach(item => {
            const sabor = item.getAttribute('data-sabor');
            const qty = parseInt(item.querySelector('.qty-input').value);
            if (qty > 0) {
                novoPedidoItens[sabor] = qty;
                totalEsfirrasSalvas += qty;
            }
        });
        
        pedidoGeral[familia][membro].itens = novoPedidoItens; 
        saveState(); 
        
        // CORREÇÃO AQUI: Usando <b> ao invés de **
        const mensagemSucesso = totalEsfirrasSalvas > 0 
            ? `O pedido de <b>${membro}</b> com <b>${totalEsfirrasSalvas}</b> esfirras foi salvo e finalizado!`
            : `O pedido de <b>${membro}</b> foi salvo como <b>vazio</b> (0 esfirras).`;

        // 1. Define a ação a ser executada ao fechar o alerta
        acaoConfirmacao = () => {
            membroEmEdicao = null; 
            goToPage('clientes-mobile');
        };

        // 2. Mostra o alerta. O botão do modal apenas chama fecharAlerta()
        mostrarAlerta(
            "Pedido Finalizado!", 
            mensagemSucesso, 
            "check_circle",
            `<button class="btn primary-btn" onclick="fecharAlerta()">Voltar p/ Clientes</button>`
        );
    });

    // === 7. Lógica do Resumo da Tela (HTML) ===
    
    function renderResumoTotal() {
        if (Object.keys(pedidoGeral).length === 0) {
            resumoTotalContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Adicione membros e seus pedidos para ver o resumo.</p>'; 
            return;
        }
        
        let resumoHtml = '';
        let totalGeralPedido = 0;
        
        const familiasOrdenadas = Object.keys(pedidoGeral).sort();
        
        familiasOrdenadas.forEach(familia => {
            let totalFamilia = 0;
            let saboresConsolidados = {}; 

            for (const membro in pedidoGeral[familia]) { 
                const itens = pedidoGeral[familia][membro]?.itens || {}; 
                for (const sabor in itens) {
                    const quantidade = itens[sabor];
                    if (quantidade > 0) {
                        const itemEstoque = estoque.find(i => i.sabor === sabor);
                        const preco = itemEstoque ? itemEstoque.preco : 0;
                        const total = quantidade * preco;
                        
                        if (!saboresConsolidados[sabor]) {
                            saboresConsolidados[sabor] = { qtd: 0, total: 0 };
                        }
                        saboresConsolidados[sabor].qtd += quantidade;
                        saboresConsolidados[sabor].total += total;
                        totalFamilia += total;
                    }
                }
            }

            totalGeralPedido += totalFamilia;

            if (totalFamilia > 0) {
                resumoHtml += `
                    <div class="resumo-familia">
                        <h3>Família: ${familia}</h3>
                        <table>
                            <thead>
                                <tr><th>Sabor</th><th>Qtd</th><th>Total</th></tr>
                            </thead>
                            <tbody>
                `;
                
                const saboresOrdenados = Object.keys(saboresConsolidados).sort();

                saboresOrdenados.forEach(sabor => {
                    const { qtd, total } = saboresConsolidados[sabor];
                    resumoHtml += `
                        <tr>
                            <td>${sabor}</td>
                            <td>${qtd}</td>
                            <td>R$ ${total.toFixed(2)}</td>
                        </tr>
                    `;
                });

                resumoHtml += `
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="2">TOTAL FAMÍLIA</td>
                                    <td>R$ ${totalFamilia.toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>
                        
                        <details>
                            <summary>Pedidos Detalhados por Membro</summary> 
                            ${generateDetalhesMembros(familia)} 
                        </details>
                        <hr>
                    </div>
                `;
            }
        });
        
        resumoTotalContainer.innerHTML = resumoHtml;
        
        if (totalGeralPedido > 0) {
            resumoTotalContainer.innerHTML += `
                <h2 style="text-align: center; color: var(--primary-color); margin-top: 20px;">TOTAL GERAL: R$ ${totalGeralPedido.toFixed(2)}</h2>
            `;
        } else {
            resumoTotalContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Nenhum pedido ativo para ver o resumo.</p>'; 
        }
    }

    function generateDetalhesMembros(familia) { 
        let detalhes = '';
        const membrosOrdenados = Object.keys(pedidoGeral[familia]).sort(); 

        membrosOrdenados.forEach(membro => { 
            const itens = pedidoGeral[familia][membro]?.itens || {}; 
            let totalMembro = 0; 
            let listaItens = '';
            
            for (const sabor in itens) {
                const quantidade = itens[sabor];
                const itemEstoque = estoque.find(i => i.sabor === sabor);
                const preco = itemEstoque ? itemEstoque.preco : 0;
                const total = quantidade * preco;
                totalMembro += total; 
                listaItens += `<li>${sabor}: ${quantidade}x (R$ ${total.toFixed(2)})</li>`;
            }
            
            if (totalMembro > 0) { 
                detalhes += `
                    <div class="detalhe-cliente"> 
                        <h4>${membro}: R$ ${totalMembro.toFixed(2)}</h4> 
                        <ul>${listaItens}</ul>
                    </div>
                `;
            }
        });
        return detalhes;
    }

    // === 8. Lógica de Geração de PDF (jsPDF) ===
    
    /**
     * Usa alerta modal sem asteriscos.
     */
    gerarPdfBtn.addEventListener('click', () => {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            mostrarAlerta("Erro de Dependência", "A biblioteca <b>jsPDF</b> ou <b>jspdf-autotable</b> não foi carregada. Verifique os scripts no seu HTML.", "error");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        let y = 20;
        let totalGeralPedido = 0;
        let saboresConsolidadosGeral = {};
        const familiasOrdenadas = Object.keys(pedidoGeral).sort();
        let detalheData = [];
        let resumoFamiliaData = []; 

        // --- 1. Cálculo e Coleta de Dados ---
        
        familiasOrdenadas.forEach(familia => {
            let totalFamilia = 0;
            let membrosComPedido = 0; 
            
            for (const membro in pedidoGeral[familia]) { 
                const itens = pedidoGeral[familia][membro]?.itens || {}; 
                let totalMembro = 0; 
                let resumoMembro = []; 
                
                for (const sabor in itens) {
                    const quantidade = itens[sabor];
                    if (quantidade > 0) {
                        const itemEstoque = estoque.find(i => i.sabor === sabor);
                        const preco = itemEstoque ? itemEstoque.preco : 0;
                        const total = quantidade * preco;
                        
                        // Consolidação Geral (Resumo por sabor)
                        if (!saboresConsolidadosGeral[sabor]) {
                            saboresConsolidadosGeral[sabor] = { qtd: 0, total: 0 };
                        }
                        saboresConsolidadosGeral[sabor].qtd += quantidade;
                        saboresConsolidadosGeral[sabor].total += total;
                        
                        totalMembro += total; 
                        totalFamilia += total;
                        
                        resumoMembro.push(`${sabor} (${quantidade}x)`); 
                    }
                }

                // Adiciona a linha de detalhe por Membro
                if (totalMembro > 0) { 
                    detalheData.push([
                        `${membro} (Família ${familia})`, 
                        resumoMembro.join(', '), 
                        `R$ ${totalMembro.toFixed(2)}` 
                    ]);
                    membrosComPedido++;
                }
            }
            
            totalGeralPedido += totalFamilia;

            // Adiciona o resumo da família
            if (totalFamilia > 0) {
                resumoFamiliaData.push([
                    `Família ${familia}`,
                    membrosComPedido,
                    `R$ ${totalFamilia.toFixed(2)}`
                ]);
            }
        });

        if (totalGeralPedido === 0) {
            mostrarAlerta("Aviso", "Não há pedidos ativos para gerar o PDF.", "info");
            return;
        }

        // --- 2. Geração da Primeira Tabela: RESUMO CONSOLIDADO GERAL ---

        doc.setFontSize(18);
        doc.text("Resumo do Pedido de Esfirras", 105, y, null, null, "center");
        y += 10;
        doc.setFontSize(10);
        doc.text(`Data: ${new Date().toLocaleDateString()}`, 105, y, null, null, "center");
        y += 15;
        
        doc.setFontSize(14);
        doc.text("1. RESUMO GERAL POR SABOR (Para Produção)", 20, y);
        y += 7;

        const resumoGeralTableData = Object.keys(saboresConsolidadosGeral).sort().map(sabor => {
            const item = saboresConsolidadosGeral[sabor];
            return [
                sabor,
                item.qtd,
                `R$ ${item.total.toFixed(2)}`
            ];
        });
        
        doc.autoTable({
            startY: y,
            head: [['Sabor', 'Quantidade Total', 'Subtotal']],
            body: resumoGeralTableData,
            foot: [['TOTAL GERAL DO PEDIDO', '', `R$ ${totalGeralPedido.toFixed(2)}`]],
            theme: 'grid',
            styles: { fontSize: 10, font: 'helvetica' },
            columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' } }
        });
        y = doc.autoTable.previous.finalY + 15;

        // --- 3. Geração da Segunda Tabela: RESUMO POR FAMÍLIA ---
        
        if (resumoFamiliaData.length > 0) {
            doc.setFontSize(14);
            doc.text("2. RESUMO POR FAMÍLIA (Subtotais)", 20, y);
            y += 7;

            doc.autoTable({
                startY: y,
                head: [['Família', 'Membros (com pedido)', 'Total Família']], 
                body: resumoFamiliaData,
                theme: 'grid',
                styles: { fontSize: 10, font: 'helvetica' },
                columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' } }
            });
            y = doc.autoTable.previous.finalY + 15;
        }


        // --- 4. Geração da Terceira Tabela: DETALHAMENTO POR MEMBRO ---

        if (detalheData.length > 0) {
            doc.setFontSize(14);
            doc.text("3. DETALHAMENTO POR MEMBRO", 20, y); 
            y += 7;
            
            doc.autoTable({
                startY: y,
                head: [['Membro/Família', 'Itens Pedidos', 'Total']], 
                body: detalheData,
                theme: 'grid',
                styles: { fontSize: 9, font: 'helvetica', cellPadding: 2 },
                columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 100 }, 2: { halign: 'right', cellWidth: 35 } }
            });
            y = doc.autoTable.previous.finalY + 10;
        }
        
        // Finalização
        if (totalGeralPedido > 0) {
            doc.setFontSize(16);
            doc.text(`TOTAL GERAL FINAL: R$ ${totalGeralPedido.toFixed(2)}`, 105, y, null, null, "center");
        }

        doc.save("Pedido_Esfirras_Completo.pdf");
        
        mostrarAlerta("PDF Gerado!", "O arquivo <b>Pedido_Esfirras_Completo.pdf</b> foi baixado com sucesso.", "file_download");
    });

    // === 9. Inicialização ===
    goToPage('clientes-mobile');
});