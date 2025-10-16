document.addEventListener('DOMContentLoaded', function() {
    // --- VARIÁVEIS GLOBAIS DO DOM ---
    const navLinks = document.querySelectorAll('.nav-link');
    const modules = document.querySelectorAll('.module');
    const moduleTitle = document.getElementById('module-title');
    
    // Configurações
    const estoqueMinimoForm = document.getElementById('estoque-minimo-form');
    const estoqueMinimoInput = document.getElementById('estoque_minimo');

    // Relatórios
    const tabelaLucratividadeBody = document.querySelector('#tabela-lucratividade tbody');
    const tabelaGiroBody = document.querySelector('#tabela-giro tbody');

    // Estoque
    const btnAddItem = document.getElementById('btn-add-item');
    const btnCancelar = document.getElementById('btn-cancelar-cadastro');
    const formCadastro = document.getElementById('form-cadastro');
    const formCadastroTitle = document.getElementById('form-cadastro-title');
    const itemForm = document.getElementById('item-form');
    const tabelaEstoqueBody = document.querySelector('#tabela-estoque tbody');
    const itemIdEdit = document.getElementById('item-id-edit');
    const estoqueAtualInput = document.getElementById('estoque_atual');
    const btnMovimentacao = document.getElementById('btn-movimentacao');
    const btnCancelarMovimentacao = document.getElementById('btn-cancelar-movimentacao');
    const formMovimentacao = document.getElementById('form-movimentacao');
    const movItemSelect = document.getElementById('mov-item-select');
    const movForm = document.getElementById('movimentacao-form');
    
    // Vendas
    const btnNovaVenda = document.getElementById('btn-nova-venda');
    const btnCancelarVenda = document.getElementById('btn-cancelar-venda');
    const formVenda = document.getElementById('form-venda');
    const vendaForm = document.getElementById('venda-form');
    const selectItemEstoque = document.getElementById('select-item-estoque');
    const btnAdicionarItem = document.getElementById('btn-adicionar-item');
    const tabelaItensVendaBody = document.querySelector('#tabela-itens-venda tbody');
    const kmTotalInput = document.getElementById('km_total');
    const custoGasolinaDisplay = document.getElementById('custo-gasolina-display');
    const totalItensDisplay = document.getElementById('total-itens-display');
    const totalFinalDisplay = document.getElementById('total-final-display');
    const tabelaVendasBody = document.querySelector('#tabela-vendas tbody');
    
    // Custos
    const configForm = document.getElementById('config-form');

    // GRÁFICO DINÂMICO
    const chartControlButtons = document.querySelectorAll('.chart-controls .btn-group button');
    let activeChartPeriod = 'mes'; // Padrão
    let vendasChartInstance = null;
    
    let carrinho = [];

    // --- VARIÁVEIS DE CONFIGURAÇÃO (LocalStorage) ---
    let config = JSON.parse(localStorage.getItem('precificacaoConfig')) || {
        precoLitro: 6.00,
        consumoMedio: 12,
        margemPadrao: 50,
        estoqueMinimoAlerta: 10
    };

    // Campos do formulário de item (existem no DOM)
    const custoInput = document.getElementById('custo');
    const precoVendaInput = document.getElementById('preco_venda');

    // Calcula e aplica preço sugerido a partir da margem padrão somente quando estivermos criando um novo item
    function applyDefaultMarginToPrice() {
        // Se estivermos editando (itemIdEdit preenchido) não sobrescreve
        if (itemIdEdit && itemIdEdit.value) return;
        if (!custoInput || !precoVendaInput) return;

        const custoVal = parseFloat(custoInput.value);
        const margem = (config && config.margemPadrao) ? parseFloat(config.margemPadrao) : 0;

        if (isNaN(custoVal) || custoVal <= 0 || isNaN(margem)) {
            // Limpa apenas se estiver vazio — permite que usuário apague o campo manualmente
            if (!precoVendaInput.value) precoVendaInput.value = '';
            return;
        }

        const precoSugerido = custoVal * (1 + margem / 100);
        // Preenche o campo, mas o usuário pode alterar/remover manualmente
        precoVendaInput.value = precoSugerido.toFixed(2);
    }

    // Escuta alterações no custo para sugerir preço automaticamente
    if (custoInput) {
        custoInput.addEventListener('input', applyDefaultMarginToPrice);
    }

    // ----------------------------------------------------------------------------------
    // I. FUNÇÕES DO DASHBOARD (GRÁFICO DINÂMICO)
    // ----------------------------------------------------------------------------------

    // Auxiliar: Agrega vendas reais (localStorage 'historicoVendas') por dia/mês/ano
    function aggregateSalesData(period) {
        const vendas = JSON.parse(localStorage.getItem('historicoVendas')) || [];
        const map = new Map(); // chave (ISO date string) -> receita

        // Normaliza e agrupa cada pedido
        vendas.forEach(pedido => {
            // tenta extrair data no formato ISO a partir do campo 'data'
            // o campo 'data' foi gravado como toLocaleDateString('pt-BR') no momento da venda
            // tentaremos parsear com Luxon usando o formato dd/MM/yyyy
            let dt = null;
            try {
                dt = luxon.DateTime.fromFormat(pedido.data, 'dd/LL/yyyy');
                if (!dt.isValid) dt = luxon.DateTime.fromISO(pedido.data);
            } catch (e) {
                dt = luxon.DateTime.fromISO(pedido.data);
            }

            if (!dt || !dt.isValid) return; // ignora entradas inválidas

            let key;
            if (period === 'mes') {
                key = dt.toISODate(); // agrupar por dia (YYYY-MM-DD)
            } else if (period === 'ano') {
                key = dt.toFormat('yyyy-LL'); // agrupar por mês (YYYY-MM)
            } else if (period === '5anos') {
                key = dt.toFormat('yyyy'); // agrupar por ano (YYYY)
            } else {
                key = dt.toISODate();
            }

            const receita = parseFloat(pedido.totalFinal) || 0;
            map.set(key, (map.get(key) || 0) + receita);
        });

        // Para garantir que períodos sem vendas apareçam no gráfico, construímos a sequência de labels
        const labels = [];
        const dataPoints = [];
        let unit = '';
        const now = luxon.DateTime.now();

        if (period === 'mes') {
            unit = 'day';
            // últimos 30 dias + dia atual (31 pontos: 30 dias anteriores + hoje)
            for (let i = 30; i >= 0; i--) {
                const d = now.minus({ days: i });
                const key = d.toISODate();
                labels.push(d.toJSDate());
                dataPoints.push(Number((map.get(key) || 0).toFixed(2)));
            }
        } else if (period === 'ano') {
            unit = 'month';
            // últimos 12 meses + mês atual (13 pontos)
            for (let i = 12; i >= 0; i--) {
                const d = now.minus({ months: i }).startOf('month');
                const key = d.toFormat('yyyy-LL');
                labels.push(d.toJSDate());
                dataPoints.push(Number((map.get(key) || 0).toFixed(2)));
            }
        } else if (period === '5anos') {
            unit = 'year';
            // últimos 5 anos + ano atual (6 pontos)
            for (let i = 5; i >= 0; i--) {
                const d = now.minus({ years: i }).startOf('year');
                const key = d.toFormat('yyyy');
                labels.push(d.toJSDate());
                dataPoints.push(Number((map.get(key) || 0).toFixed(2)));
            }
        }

        return {
            labels: labels,
            data: dataPoints,
            unit: unit
        };
    }

    // Inicializa ou atualiza o gráfico
    function initCharts(period) {
        const vendasCtx = document.getElementById('vendasChart');
        if (!vendasCtx) return;

    const salesData = aggregateSalesData(period);
    const { labels, data, unit } = salesData;

        const vendasData = {
            labels: labels,
            datasets: [{ 
                label: 'Receita (R$)', 
                data: data, 
                borderColor: '#007bff', 
                backgroundColor: 'rgba(0, 123, 255, 0.1)', 
                tension: 0.3, 
                fill: true 
            }]
        };

        const chartConfig = {
            type: 'line',
            data: vendasData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time', // Escala de tempo habilitada (requer Luxon e adapter)
                        time: {
                            unit: unit,
                            tooltipFormat: unit === 'day' ? 'dd/MM/yyyy' : unit === 'month' ? 'MMM/yyyy' : 'yyyy',
                            displayFormats: {
                                day: 'dd/MM',
                                month: 'MMM/yy',
                                year: 'yyyy'
                            }
                        },
                        title: {
                            display: true,
                            text: unit === 'day' ? 'Últimos 30 dias' : unit === 'month' ? 'Últimos 12 meses' : 'Últimos 5 Anos'
                        }
                    },
                    y: {
                        beginAtZero: true,
                         // FORMATO DO EIXO Y: R$
                        ticks: {
                            callback: function(value, index, ticks) {
                                return 'R$ ' + value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                            }
                        },
                        title: {
                            display: true,
                            text: 'Receita (R$)'
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                         callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += 'R$ ' + context.parsed.y.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        };

        if (vendasChartInstance) {
            // Atualiza o gráfico existente
            vendasChartInstance.data = vendasData;
            vendasChartInstance.options = chartConfig.options;
            vendasChartInstance.update();
        } else {
            // Cria um novo gráfico
            vendasChartInstance = new Chart(vendasCtx.getContext('2d'), chartConfig);
        }
    }

    function loadDashboardData() {
        const vendas = JSON.parse(localStorage.getItem('historicoVendas')) || [];
        const estoque = getEstoque();

        // 1. Calcular KPIs (Receita e Lucro dos últimos 30 dias)
        let receitaTotal = 0;
        let lucroTotal = 0;
        
        vendas.forEach(pedido => {
            receitaTotal += parseFloat(pedido.totalFinal);
            lucroTotal += parseFloat(pedido.lucroEstimado); 
        });

        const estoqueTotalItens = estoque.reduce((sum, item) => sum + item.estoque, 0);
        const alertas = estoque.filter(item => item.estoque < config.estoqueMinimoAlerta).length;

        // 2. Atualizar o DOM
        document.getElementById('kpi-receita').textContent = `R$ ${receitaTotal.toFixed(2)}`;
        document.getElementById('kpi-lucro').textContent = `R$ ${lucroTotal.toFixed(2)}`;
        document.getElementById('kpi-estoque-total').textContent = `${estoqueTotalItens} Itens`;
        document.getElementById('kpi-alertas').textContent = `${alertas} Produtos`;

        // 3. Renderizar Gráfico
        initCharts(activeChartPeriod);
    }

    // ----------------------------------------------------------------------------------
    // II. FUNÇÕES DE NAVEGAÇÃO E UTILS
    // ----------------------------------------------------------------------------------

    function getEstoque() {
        return JSON.parse(localStorage.getItem('acessoriosEstoque')) || [
            { id: 1, nome: "Cordas Violão Aço", sku: "ACR-010", custo: 15.00, estoque: 50, preco: 29.90 },
            { id: 2, nome: "Afinador Clip Digital", sku: "AFD-CR", custo: 35.00, estoque: 30, preco: 69.90 }
        ];
    }

    function updateEstoque(itensVendidos) {
        let estoqueAtual = getEstoque();
        itensVendidos.forEach(itemVendido => {
            const itemEstoqueIndex = estoqueAtual.findIndex(item => item.id === itemVendido.id);
            if (itemEstoqueIndex !== -1) {
                estoqueAtual[itemEstoqueIndex].estoque -= itemVendido.quantidade;
                if (estoqueAtual[itemEstoqueIndex].estoque < 0) estoqueAtual[itemEstoqueIndex].estoque = 0;
            }
        });
        localStorage.setItem('acessoriosEstoque', JSON.stringify(estoqueAtual));
    }
    
    function setActiveModule(moduleName) {
        modules.forEach(mod => mod.classList.remove('active'));
        navLinks.forEach(link => link.classList.remove('active'));

        const activeModule = document.getElementById(moduleName);
        if (activeModule) {
            activeModule.classList.add('active');
            const activeLink = document.querySelector(`.nav-link[data-module="${moduleName}"]`);
            if (activeLink) {
                activeLink.classList.add('active');
                moduleTitle.textContent = activeLink.textContent.trim() + ' - Herkon'; 
            }
        }
        
        // Funções de carregamento específicas do módulo
        if (moduleName === 'dashboard') loadDashboardData();
        if (moduleName === 'estoque') {
             loadEstoque();
             loadMovimentacaoDropdown();
           loadMovimentacoesHistory();
        }
        if (moduleName === 'custos') loadConfigForm();
        if (moduleName === 'vendas') {
            loadVendasHistory();
            loadEstoqueDropdown();
        }
        if (moduleName === 'relatorios') loadRelatorios();
        if (moduleName === 'configuracoes') loadConfiguracoes();

        // Oculta formulários ao mudar de módulo
        formCadastro.style.display = 'none';
        formMovimentacao.style.display = 'none';
        btnAddItem.style.display = 'inline-block';
        btnMovimentacao.style.display = 'inline-block';
        formVenda.style.display = 'none';
        btnNovaVenda.style.display = 'inline-block';
    }

    // ----------------------------------------------------------------------------------
    // III. MÓDULO ESTOQUE
    // ----------------------------------------------------------------------------------
    
    function loadEstoque() {
        const itens = getEstoque();
        tabelaEstoqueBody.innerHTML = '';
        
        itens.forEach(item => {
            const row = tabelaEstoqueBody.insertRow();
            row.insertCell().textContent = item.nome;
            row.insertCell().textContent = item.sku;
            row.insertCell().textContent = item.estoque;
            row.insertCell().textContent = `R$ ${item.custo.toFixed(2)}`;
            row.insertCell().textContent = `R$ ${item.preco.toFixed(2)}`;
            
            const actionCell = row.insertCell();
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Editar';
            editBtn.className = 'btn btn-primary btn-sm';
            editBtn.style.marginRight = '5px';
            editBtn.onclick = () => editItem(item.id);
            actionCell.appendChild(editBtn);
        });
        localStorage.setItem('acessoriosEstoque', JSON.stringify(itens));
    }
    
    window.editItem = function(itemId) {
        const item = getEstoque().find(i => i.id === itemId);
        if (!item) return;

        formMovimentacao.style.display = 'none';
        btnMovimentacao.style.display = 'inline-block';

        formCadastroTitle.textContent = "Editar Acessório";
        itemIdEdit.value = item.id;
        document.getElementById('nome').value = item.nome;
        document.getElementById('sku').value = item.sku;
        document.getElementById('custo').value = item.custo;
        document.getElementById('preco_venda').value = item.preco;
        estoqueAtualInput.value = item.estoque;
        estoqueAtualInput.readOnly = true; 
        
        formCadastro.style.display = 'block';
        btnAddItem.style.display = 'none';
    }

    itemForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const id = parseInt(itemIdEdit.value);
        const nome = document.getElementById('nome').value;
        const sku = document.getElementById('sku').value;
        const custo = parseFloat(document.getElementById('custo').value);
        const preco = parseFloat(document.getElementById('preco_venda').value);

        let itens = getEstoque();

        if (id) {
            const itemIndex = itens.findIndex(i => i.id === id);
            if (itemIndex !== -1) {
                itens[itemIndex].nome = nome;
                itens[itemIndex].sku = sku;
                itens[itemIndex].custo = custo; 
                itens[itemIndex].preco = preco;
                alert(`Acessório "${nome}" atualizado com sucesso!`);
            }
        } else {
            const newId = itens.length > 0 ? Math.max(...itens.map(i => i.id)) + 1 : 1;
            const novoItem = { id: newId, nome, sku, custo, estoque: 0, preco };
            itens.push(novoItem);
            alert(`Acessório "${nome}" adicionado com sucesso (Estoque inicial zero).`);
        }
        
        localStorage.setItem('acessoriosEstoque', JSON.stringify(itens));
        
        itemIdEdit.value = '';
        itemForm.reset();
        formCadastro.style.display = 'none';
        btnAddItem.style.display = 'inline-block';
        estoqueAtualInput.readOnly = false;
        formCadastroTitle.textContent = "Adicionar Novo Acessório";
        loadEstoque();
    });

    btnAddItem.addEventListener('click', () => {
        formMovimentacao.style.display = 'none';
        btnMovimentacao.style.display = 'inline-block';

        formCadastroTitle.textContent = "Adicionar Novo Acessório";
        itemIdEdit.value = '';
        itemForm.reset();
        estoqueAtualInput.value = 0;
        estoqueAtualInput.readOnly = true; 
        // Aplica preço sugerido com base no custo (após reset, custo estará vazio até usuário digitar)
        applyDefaultMarginToPrice();

        formCadastro.style.display = 'block';
        btnAddItem.style.display = 'none';
    });

    btnCancelar.addEventListener('click', () => {
        formCadastro.style.display = 'none';
        btnAddItem.style.display = 'inline-block';
        itemIdEdit.value = '';
        itemForm.reset();
        estoqueAtualInput.readOnly = false;
    });

    function loadMovimentacaoDropdown() {
        const itens = getEstoque();
        const datalist = document.getElementById('mov-items-list');
        if (!datalist) return;
        datalist.innerHTML = '';
        // Preenche datalist com value contendo id e nome para facilitar lookup
        itens.forEach(item => {
            const option = document.createElement('option');
            // value será no formato: ID|Nome para depois buscarmos por id
            option.value = `${item.id}|${item.nome} (Estoque: ${item.estoque})`;
            datalist.appendChild(option);
        });
        // Limpa o input atual se o item não existir mais
        if (movItemSelect.value) {
            const exists = itens.some(i => movItemSelect.value.includes(`${i.id}|`));
            if (!exists) movItemSelect.value = '';
        }
    }

    // Histórico de movimentações: grava e carrega
    function saveMovimentacaoHistorico(record) {
        const hist = JSON.parse(localStorage.getItem('historicoMovimentacoes')) || [];
        hist.unshift(record);
        localStorage.setItem('historicoMovimentacoes', JSON.stringify(hist));
    }

    function loadMovimentacoesHistory() {
        const hist = JSON.parse(localStorage.getItem('historicoMovimentacoes')) || [];
        const tbody = document.querySelector('#tabela-movimentacoes tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        hist.forEach(rec => {
            const row = tbody.insertRow();
            row.insertCell().textContent = `#${rec.id.toString().slice(-6)}`;
            row.insertCell().textContent = rec.itemNome;
            const tipoCell = row.insertCell();
            const tipoRaw = (rec.tipo || '').toLowerCase();
            if (tipoRaw === 'entrada') {
                tipoCell.textContent = 'Entrada';
                tipoCell.className = 'tipo-entrada';
            } else if (tipoRaw === 'saida' || tipoRaw === 'saída') {
                tipoCell.textContent = 'Saída';
                tipoCell.className = 'tipo-saida';
            } else {
                tipoCell.textContent = rec.tipo || '';
            }
            row.insertCell().textContent = rec.qtdAnterior;
            row.insertCell().textContent = rec.qtdMovimentacao;
            row.insertCell().textContent = rec.qtdAtual;
            row.insertCell().textContent = rec.data;
            row.insertCell().textContent = rec.usuario || '—';
            row.insertCell().textContent = rec.motivo || '';
        });
    }

    // Mostrar/ocultar campo de relatório quando tipo === 'saida'
    const movTipoSelect = document.getElementById('mov-tipo');
    const movRelatorioContainer = document.getElementById('mov-relatorio-container');
    const movRelatorioTextarea = document.getElementById('mov-relatorio');
    if (movTipoSelect) {
        movTipoSelect.addEventListener('change', function() {
            if (this.value === 'saida') {
                if (movRelatorioContainer) movRelatorioContainer.style.display = 'block';
            } else {
                if (movRelatorioContainer) movRelatorioContainer.style.display = 'none';
                if (movRelatorioTextarea) movRelatorioTextarea.value = '';
            }
        });
    }

    btnMovimentacao.addEventListener('click', () => {
        formCadastro.style.display = 'none';
        btnAddItem.style.display = 'inline-block';

        formMovimentacao.style.display = 'block';
        btnMovimentacao.style.display = 'none';
        loadMovimentacaoDropdown();
        movForm.reset();
    });

    btnCancelarMovimentacao.addEventListener('click', () => {
        formMovimentacao.style.display = 'none';
        btnMovimentacao.style.display = 'inline-block';
        movForm.reset();
    });

    movForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // movItemSelect is now an input with value 'id|nome (...)' or user can type the full name
        const rawVal = movItemSelect.value || '';
        let itemId = null;
        // If user selected an option we encoded as 'id|...'
        if (rawVal.includes('|')) {
            const parts = rawVal.split('|');
            itemId = parseInt(parts[0]);
        } else {
            // fallback: try to match by name start
            const itens = getEstoque();
            const match = itens.find(i => rawVal.toLowerCase().startsWith(i.nome.toLowerCase()));
            if (match) itemId = match.id;
        }
        
        const tipo = document.getElementById('mov-tipo').value;
        const quantidade = parseInt(document.getElementById('mov-quantidade').value);
        
        if (!itemId || quantidade <= 0) return alert('Selecione um item e a quantidade.');

        // Se for saída, exige preenchimento do relatório
        if (tipo === 'saida') {
            const motivo = (movRelatorioTextarea && movRelatorioTextarea.value) ? movRelatorioTextarea.value.trim() : '';
            if (!motivo) {
                if (movRelatorioContainer) movRelatorioContainer.style.display = 'block';
                return alert('Para registrar uma saída, preencha o relatório com o motivo da saída.');
            }
        }

        let itens = getEstoque();
        const itemIndex = itens.findIndex(i => i.id === itemId);
        
        if (itemIndex === -1) return;

        const itemNome = itens[itemIndex].nome;

        if (tipo === 'entrada') {
            const qtdAnterior = itens[itemIndex].estoque;
            itens[itemIndex].estoque += quantidade;
            const qtdAtual = itens[itemIndex].estoque;
            // salva histórico
            const rec = {
                id: Date.now(),
                itemId: itemId,
                itemNome: itemNome,
                tipo: 'entrada',
                qtdAnterior: qtdAnterior,
                qtdMovimentacao: quantidade,
                qtdAtual: qtdAtual,
                data: new Date().toLocaleString('pt-BR'),
                usuario: 'Sr. Herbert',
                motivo: ''
            };
            saveMovimentacaoHistorico(rec);
            alert(`Entrada de ${quantidade} unidades de ${itemNome} registrada. Novo estoque: ${itens[itemIndex].estoque}`);
        } else if (tipo === 'saida') {
            if (itens[itemIndex].estoque < quantidade) {
                return alert(`Erro: Estoque insuficiente. Só há ${itens[itemIndex].estoque} unidades de ${itemNome}.`);
            }
            const qtdAnterior = itens[itemIndex].estoque;
            itens[itemIndex].estoque -= quantidade;
            const qtdAtual = itens[itemIndex].estoque;
            const motivo = movRelatorioTextarea ? movRelatorioTextarea.value.trim() : '';
            const rec = {
                id: Date.now(),
                itemId: itemId,
                itemNome: itemNome,
                tipo: 'saida',
                qtdAnterior: qtdAnterior,
                qtdMovimentacao: -Math.abs(quantidade),
                qtdAtual: qtdAtual,
                data: new Date().toLocaleString('pt-BR'),
                usuario: 'Sr. Herbert',
                motivo: motivo
            };
            saveMovimentacaoHistorico(rec);
            alert(`Saída de ${quantidade} unidades de ${itemNome} registrada. Motivo: ${motivo}. Novo estoque: ${itens[itemIndex].estoque}`);
        }

        localStorage.setItem('acessoriosEstoque', JSON.stringify(itens));
        
        formMovimentacao.style.display = 'none';
        btnMovimentacao.style.display = 'inline-block';
        loadEstoque();
        loadMovimentacoesHistory();
        loadMovimentacaoDropdown();
    });

    // ----------------------------------------------------------------------------------
    // IV. MÓDULO VENDAS
    // ----------------------------------------------------------------------------------

    function calcularCustoGasolina(km) {
        if (km <= 0) return 0;
        const litros = km / config.consumoMedio;
        return litros * config.precoLitro;
    }

    function updateResumoVenda() {
        const km = parseFloat(kmTotalInput.value) || 0;
        const custoGasolina = calcularCustoGasolina(km);
        
        const totalItens = carrinho.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
        const totalFinal = totalItens + custoGasolina;

        custoGasolinaDisplay.textContent = `R$ ${custoGasolina.toFixed(2)}`;
        totalItensDisplay.textContent = `R$ ${totalItens.toFixed(2)}`;
        totalFinalDisplay.textContent = `R$ ${totalFinal.toFixed(2)}`;
        
        return { custoGasolina, totalItens, totalFinal };
    }

    kmTotalInput.addEventListener('input', updateResumoVenda);

    function loadEstoqueDropdown() {
        const itens = getEstoque();
        selectItemEstoque.innerHTML = '<option value="">-- Selecione um Acessório --</option>';
        itens.forEach(item => {
            if (item.estoque > 0) {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = `${item.nome} (R$ ${item.preco.toFixed(2)} | Estoque: ${item.estoque})`;
                option.setAttribute('data-preco', item.preco);
                option.setAttribute('data-custo', item.custo);
                option.setAttribute('data-estoque', item.estoque);
                selectItemEstoque.appendChild(option);
            }
        });
    }

    btnAdicionarItem.addEventListener('click', () => {
        const selectedOption = selectItemEstoque.options[selectItemEstoque.selectedIndex];
        const itemId = parseInt(selectedOption.value);
        const quantidade = parseInt(document.getElementById('qtd-item').value);
        const estoqueDisponivel = parseInt(selectedOption.getAttribute('data-estoque'));

        if (!itemId || quantidade <= 0) {
            alert('Selecione um item e insira uma quantidade válida.');
            return;
        }
        
        if (quantidade > estoqueDisponivel) {
            alert(`Estoque insuficiente. Máximo disponível: ${estoqueDisponivel}`);
            return;
        }

        const preco = parseFloat(selectedOption.getAttribute('data-preco'));
        const custo = parseFloat(selectedOption.getAttribute('data-custo'));
        const nome = selectedOption.textContent.split('(')[0].trim();

        const itemExistente = carrinho.find(item => item.id === itemId);
        if (itemExistente) {
            if (itemExistente.quantidade + quantidade > estoqueDisponivel) {
                alert(`Estoque insuficiente para a quantidade total desejada. Máximo: ${estoqueDisponivel}`);
                return;
            }
            itemExistente.quantidade += quantidade;
        } else {
            carrinho.push({ id: itemId, nome, preco, custo, quantidade });
        }
        
        renderCarrinho();
        updateResumoVenda();
    });
    
    function renderCarrinho() {
        tabelaItensVendaBody.innerHTML = '';
        carrinho.forEach((item, index) => {
            const row = tabelaItensVendaBody.insertRow();
            row.insertCell().textContent = item.nome;
            row.insertCell().textContent = `R$ ${item.preco.toFixed(2)}`;
            row.insertCell().textContent = item.quantidade;
            row.insertCell().textContent = `R$ ${(item.preco * item.quantidade).toFixed(2)}`;
            
            const actionCell = row.insertCell();
            const btn = document.createElement('button');
            btn.textContent = 'Remover';
            btn.className = 'btn btn-danger btn-sm';
            btn.onclick = () => {
                carrinho.splice(index, 1);
                renderCarrinho();
                updateResumoVenda();
            };
            actionCell.appendChild(btn);
        });
    }

    vendaForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (carrinho.length === 0) {
            alert('Adicione pelo menos um item ao pedido.');
            return;
        }
        
        const clienteNome = document.getElementById('cliente_nome').value;
        const kmTotal = parseFloat(document.getElementById('km_total').value) || 0;
        const { custoGasolina, totalItens, totalFinal } = updateResumoVenda();

        const cmvTotal = carrinho.reduce((sum, item) => sum + (item.custo * item.quantidade), 0);
        const lucroEstimado = totalItens - cmvTotal - custoGasolina;

        const novoPedido = {
            id: Date.now(),
            data: new Date().toLocaleDateString('pt-BR'),
            cliente: clienteNome,
            kmTotal: kmTotal,
            totalFinal: totalFinal.toFixed(2),
            custoGasolina: custoGasolina.toFixed(2),
            lucroEstimado: lucroEstimado.toFixed(2),
            itens: carrinho
        };

        const pedidos = JSON.parse(localStorage.getItem('historicoVendas')) || [];
        pedidos.unshift(novoPedido);
        localStorage.setItem('historicoVendas', JSON.stringify(pedidos));
        
        updateEstoque(carrinho); 

        alert(`Pedido finalizado! Total: R$ ${totalFinal.toFixed(2)}. Lucro Estimado: R$ ${lucroEstimado.toFixed(2)}. Estoque atualizado.`);
        
        vendaForm.reset();
        carrinho = [];
        renderCarrinho();
        updateResumoVenda();
        loadVendasHistory();
        loadEstoqueDropdown();
        formVenda.style.display = 'none';
        btnNovaVenda.style.display = 'inline-block';
    });

    function loadVendasHistory() {
        const pedidos = JSON.parse(localStorage.getItem('historicoVendas')) || [];
        tabelaVendasBody.innerHTML = '';
        
        pedidos.forEach(pedido => {
            const row = tabelaVendasBody.insertRow();
            row.insertCell().textContent = `#${pedido.id.toString().slice(-4)}`;
            row.insertCell().textContent = pedido.data;
            row.insertCell().textContent = pedido.cliente;
            row.insertCell().textContent = `${pedido.kmTotal} km`;
            row.insertCell().textContent = `R$ ${pedido.totalFinal}`;
            row.insertCell().textContent = `R$ ${pedido.custoGasolina}`;
            
            const lucroCell = row.insertCell();
            lucroCell.textContent = `R$ ${pedido.lucroEstimado}`;
            lucroCell.style.color = parseFloat(pedido.lucroEstimado) > 0 ? '#28a745' : '#dc3545';
        });
    }

    btnNovaVenda.addEventListener('click', () => {
        formVenda.style.display = 'block';
        btnNovaVenda.style.display = 'none';
        carrinho = [];
        renderCarrinho();
        updateResumoVenda();
        loadEstoqueDropdown();
    });

    btnCancelarVenda.addEventListener('click', () => {
        formVenda.style.display = 'none';
        btnNovaVenda.style.display = 'inline-block';
        vendaForm.reset();
        carrinho = [];
        renderCarrinho();
        updateResumoVenda();
    });

    // ----------------------------------------------------------------------------------
    // V. MÓDULO CUSTOS
    // ----------------------------------------------------------------------------------

    function loadConfigForm() {
        document.getElementById('preco_litro').value = config.precoLitro;
        document.getElementById('consumo_medio').value = config.consumoMedio;
        document.getElementById('margem_padrao').value = config.margemPadrao;
    }

    configForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        config.precoLitro = parseFloat(document.getElementById('preco_litro').value);
        config.consumoMedio = parseInt(document.getElementById('consumo_medio').value);
        config.margemPadrao = parseInt(document.getElementById('margem_padrao').value);

        localStorage.setItem('precificacaoConfig', JSON.stringify(config));
        alert('Configurações de precificação salvas com sucesso!');
        loadConfigForm();
    });

    // ----------------------------------------------------------------------------------
    // VI. MÓDULO RELATÓRIOS
    // ----------------------------------------------------------------------------------

    function loadRelatorios() {
        const vendas = JSON.parse(localStorage.getItem('historicoVendas')) || [];
        const estoque = getEstoque();
        
        // 1. Processar Lucratividade
        const resumoLucratividade = {};
        vendas.forEach(pedido => {
            pedido.itens.forEach(itemVendido => {
                const itemId = itemVendido.id;
                const quantidade = itemVendido.quantidade;
                const receitaItem = itemVendido.preco * quantidade;
                const cmvItem = itemVendido.custo * quantidade;
                
                if (!resumoLucratividade[itemId]) {
                    const itemData = estoque.find(i => i.id === itemId) || { nome: itemVendido.nome };
                    resumoLucratividade[itemId] = {
                        nome: itemData.nome,
                        qtdVendida: 0,
                        receitaBruta: 0,
                        cmvTotal: 0
                    };
                }
                resumoLucratividade[itemId].qtdVendida += quantidade;
                resumoLucratividade[itemId].receitaBruta += receitaItem;
                resumoLucratividade[itemId].cmvTotal += cmvItem;
            });
        });

        tabelaLucratividadeBody.innerHTML = '';
        Object.values(resumoLucratividade).forEach(item => {
            const lucroBruto = item.receitaBruta - item.cmvTotal;
            const margem = item.receitaBruta > 0 ? (lucroBruto / item.receitaBruta) * 100 : 0;
            
            const row = tabelaLucratividadeBody.insertRow();
            row.insertCell().textContent = item.nome;
            row.insertCell().textContent = item.qtdVendida;
            row.insertCell().textContent = `R$ ${item.receitaBruta.toFixed(2)}`;
            row.insertCell().textContent = `R$ ${item.cmvTotal.toFixed(2)}`;
            row.insertCell().textContent = `R$ ${lucroBruto.toFixed(2)}`;
            row.insertCell().textContent = `${margem.toFixed(1)}%`;
        });

        // 2. Processar Giro de Estoque
        tabelaGiroBody.innerHTML = '';
        estoque.forEach(item => {
            const itemVendido = resumoLucratividade[item.id] || { qtdVendida: 0 };
            const qtdVendida = itemVendido.qtdVendida;
            
            let estoqueEmDias = 'N/A';
            let status = 'Baixo';

            const row = tabelaGiroBody.insertRow();
            
            if (qtdVendida > 0) {
                const vendaMediaDiaria = qtdVendida / 30;
                estoqueEmDias = (item.estoque / vendaMediaDiaria).toFixed(0);
                
                if (estoqueEmDias > 60) {
                    status = 'Alto (Risco de Obsoletismo)';
                    row.style.backgroundColor = '#fff3cd'; 
                } else if (estoqueEmDias > 30) {
                    status = 'Ideal';
                } else if (estoqueEmDias > 0) {
                    status = 'Médio';
                }
            } else if (item.estoque > 0) {
                 status = 'Parado (Sem Vendas)';
                 estoqueEmDias = 'Infinito';
                 row.style.backgroundColor = '#f8d7da'; 
            }

            row.insertCell().textContent = item.nome;
            row.insertCell().textContent = item.estoque;
            row.insertCell().textContent = qtdVendida;
            row.insertCell().textContent = estoqueEmDias;
            row.insertCell().textContent = status;
        });
    }

    // ----------------------------------------------------------------------------------
    // VII. MÓDULO CONFIGURAÇÕES
    // ----------------------------------------------------------------------------------

    function loadConfiguracoes() {
        estoqueMinimoInput.value = config.estoqueMinimoAlerta;
    }

    estoqueMinimoForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        config.estoqueMinimoAlerta = parseInt(estoqueMinimoInput.value);
        localStorage.setItem('precificacaoConfig', JSON.stringify(config));
        alert('Regra de Estoque Mínimo salva com sucesso!');
        loadDashboardData(); 
    });


    // ----------------------------------------------------------------------------------
    // VIII. INICIALIZAÇÃO E LISTENERS
    // ----------------------------------------------------------------------------------
    
    // Listeners de Navegação
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            setActiveModule(this.getAttribute('data-module'));
        });
    });

    // Listeners dos Controles do Gráfico
    chartControlButtons.forEach(button => {
        button.addEventListener('click', function() {
            // 1. Atualiza o estado ativo dos botões
            chartControlButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // 2. Define o novo período ativo
            activeChartPeriod = this.getAttribute('data-period');
            
            // 3. Redesenha o gráfico
            initCharts(activeChartPeriod);
        });
    });

    // Inicialização do Dashboard
    setActiveModule('dashboard'); 
});