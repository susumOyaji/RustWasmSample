// main.js - v_final

// Global state
let myPortfolio = [];
let isAutoUpdateActive = false;
let autoUpdateIntervalId = null;
let countdownIntervalId = null;
let timeRemaining = 0;

const WORKER_URL = '/worker-data';

// --- DOM Element Caching ---
const dom = {};

function cacheDOMElements() {
    // Main page elements
    dom.stockCodesInput = document.getElementById('stockCodesInput');
    dom.fetchDataButton = document.getElementById('fetchDataButton');
    dom.openPortfolioModalBtn = document.getElementById('openPortfolioModalBtn');
    dom.toggleAutoUpdateBtn = document.getElementById('toggle-auto-update-btn');
    dom.updateIntervalSelect = document.getElementById('update-interval');
    dom.countdownDisplay = document.getElementById('countdown-display');
    dom.resultsLoading = document.getElementById('resultsLoading');
    dom.searchRawData = document.getElementById('searchRawData');
    dom.indexForexContainer = document.getElementById('index-forex-container');
    dom.stockContainer = document.getElementById('stock-container');
    dom.portfolioContainer = document.getElementById('portfolio-container');

    // Modal elements
    dom.portfolioModal = document.getElementById('portfolioModal');
    dom.closeModalBtn = document.querySelector('.close-button');
    dom.cancelPortfolioModalBtn = document.getElementById('cancelPortfolioModalBtn');
    dom.modalStockCodesInput = document.getElementById('modalStockCodesInput');
    dom.modalFetchDataButton = document.getElementById('modalFetchDataButton');
    dom.modalResultsLoading = document.getElementById('modal-resultsLoading');
    dom.modalIndexForexContainer = document.getElementById('modal-index-forex-container');
    dom.modalStockContainer = document.getElementById('modal-stock-container');
    dom.modalTotalProfitLoss = document.getElementById('modal-totalSearchResultsProfitLoss');
    
    // Portfolio Form elements
    dom.portfolioTableBody = document.querySelector('#portfolioTable tbody');
    dom.portfolioTotalValue = document.getElementById('portfolioTotalValue');
    dom.portfolioTotalProfit = document.getElementById('portfolioTotalProfit');
    dom.portfolioCodeInput = document.getElementById('portfolioCode');
    dom.portfolioSharesInput = document.getElementById('portfolioShares');
    dom.portfolioPriceInput = document.getElementById('portfolioPrice');
    dom.addOrUpdatePortfolioBtn = document.getElementById('addOrUpdatePortfolioBtn');
    dom.clearPortfolioFormBtn = document.getElementById('clearPortfolioFormBtn');
}


// --- Portfolio Management ---

function loadPortfolio() {
    const storedPortfolio = localStorage.getItem('myPortfolio');
    myPortfolio = storedPortfolio ? JSON.parse(storedPortfolio) : [];
}

function savePortfolio() {
    localStorage.setItem('myPortfolio', JSON.stringify(myPortfolio));
}

function openModal(isEditMode = false, itemIndex = -1) {
    if (!dom.portfolioModal) return;
    dom.portfolioModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    renderPortfolio();

    if (isEditMode && itemIndex > -1) {
        const item = myPortfolio[itemIndex];
        dom.portfolioCodeInput.value = item.code;
        dom.portfolioSharesInput.value = item.shares;
        dom.portfolioPriceInput.value = item.purchasePrice;
        dom.addOrUpdatePortfolioBtn.textContent = '更新を保存';
        dom.addOrUpdatePortfolioBtn.setAttribute('data-editing-index', itemIndex);
        dom.portfolioCodeInput.disabled = true;
    } else {
        clearPortfolioForm();
    }
}

function closeModal() {
    if (!dom.portfolioModal) return;
    dom.portfolioModal.style.display = 'none';
    document.body.style.overflow = '';
    clearPortfolioForm();
}

async function renderPortfolio() {
    if (!dom.portfolioTableBody || !dom.portfolioTotalValue || !dom.portfolioTotalProfit) return;

    dom.portfolioTableBody.innerHTML = '<tr><td colspan="8">ポートフォリオデータを読み込み中...</td></tr>';
    let totalCurrentValue = 0;
    let totalInvestment = 0;

    const codesToFetch = myPortfolio.map(item => item.code).join(',');
    const currentPrices = {};

    console.log('renderPortfolio: codesToFetch =', codesToFetch);

    if (codesToFetch) {
        try {
            const response = await fetch(`${WORKER_URL}?codes=${encodeURIComponent(codesToFetch)}`);
            const data = await response.json();
            console.log('renderPortfolio: API response data =', data);
            if (response.ok && data.status === 'success' && Array.isArray(data.data.data)) {
                data.data.data.forEach(item => {
                    if (item.status !== 'error' && (item.code || item.symbol)) {
                        const rawPrice = item.current_value !== null ? item.current_value : item.bid_value;
                        // rawPrice が null または undefined でないことを確認
                        if (rawPrice !== null && rawPrice !== undefined) {
                            const parsedPrice = parseFloat(String(rawPrice).replace(/,/g, ''));
                            // parsedPrice が NaN でないことを確認
                            if (!isNaN(parsedPrice)) {
                                currentPrices[item.code || item.symbol] = parsedPrice;
                            } else {
                                console.warn(`価格を解析できませんでした ${item.code || item.symbol}:`, rawPrice);
                            }
                        }
                    }
                });
                console.log('renderPortfolio: currentPrices after population =', currentPrices);
            } else {
                console.error('renderPortfolio: API response not successful or data not array.', data);
            }
        } catch (error) {
            console.error('Failed to fetch portfolio prices:', error);
            dom.portfolioTableBody.innerHTML = '<tr><td colspan="8" style="color:red;">価格データの取得に失敗しました。</td></tr>';
        }
    }
    
    dom.portfolioTableBody.innerHTML = '';

    if (myPortfolio.length === 0) {
        dom.portfolioTableBody.innerHTML = '<tr><td colspan="8">ポートフォリオに銘柄がありません。</td></tr>';
    }

    myPortfolio.forEach((item, index) => {
        const row = dom.portfolioTableBody.insertRow();
        console.log('renderPortfolio: Processing portfolio item =', item);
        const currentPrice = currentPrices[item.code || item.symbol];
        console.log('renderPortfolio: currentPrice for item =', item.code || item.symbol, 'is', currentPrice);
        const investment = item.shares * item.purchasePrice;
        let currentValue = 'N/A', profitLoss = 'N/A', profitLossPercentage = 'N/A', profitLossClass = '';

        if (typeof currentPrice === 'number') {
            currentValue = currentPrice * item.shares;
            profitLoss = currentValue - investment;
            profitLossPercentage = investment !== 0 ? (profitLoss / investment) * 100 : 0;
            totalCurrentValue += currentValue;
            totalInvestment += investment;
            if (profitLoss > 0) profitLossClass = 'positive';
            else if (profitLoss < 0) profitLossClass = 'negative';
        }

        row.innerHTML = `
            <td data-label="企業コード">${item.code}</td>
            <td data-label="取得株数">${item.shares.toLocaleString()}株</td>
            <td data-label="購入単価">${item.purchasePrice.toLocaleString()}円</td>
            <td data-label="現在株価">${typeof currentPrice === 'number' ? currentPrice.toLocaleString() + '円' : 'N/A'}</td>
            <td data-label="評価額">${typeof currentValue === 'number' ? currentValue.toLocaleString() + '円' : 'N/A'}</td>
            <td data-label="評価損益" class="${profitLossClass}">${typeof profitLoss === 'number' ? (profitLoss > 0 ? '+' : '') + profitLoss.toLocaleString() + '円' : 'N/A'}</td>
            <td data-label="損益率" class="${profitLossClass}">${typeof profitLossPercentage === 'number' ? (profitLossPercentage > 0 ? '+' : '') + profitLossPercentage.toFixed(2) + '%' : 'N/A'}</td>
            <td data-label="操作">
                <button data-index="${index}" class="edit-portfolio-btn">編集</button>
                <button data-index="${index}" class="delete-portfolio-btn">削除</button>
            </td>
        `;
    });

    dom.portfolioTotalValue.textContent = `合計評価額: ${totalCurrentValue.toLocaleString()}円`;
    const totalProfitLoss = totalCurrentValue - totalInvestment;
    dom.portfolioTotalProfit.textContent = `合計評価損益: ${totalProfitLoss > 0 ? '+' : ''}${totalProfitLoss.toLocaleString()}円`;
    dom.portfolioTotalProfit.className = totalProfitLoss > 0 ? 'positive' : (totalProfitLoss < 0 ? 'negative' : '');

    attachPortfolioEventListeners();
}

function clearPortfolioForm() {
    if (!dom.portfolioCodeInput) return;
    dom.portfolioCodeInput.value = '';
    dom.portfolioSharesInput.value = '100';
    dom.portfolioPriceInput.value = '1000';
    dom.addOrUpdatePortfolioBtn.textContent = '銘柄を追加 / 更新';
    dom.addOrUpdatePortfolioBtn.removeAttribute('data-editing-index');
    dom.portfolioCodeInput.disabled = false;
}

function handleAddOrUpdatePortfolio() {
    const code = dom.portfolioCodeInput.value.trim().toUpperCase();
    const shares = parseInt(dom.portfolioSharesInput.value, 10);
    const purchasePrice = parseFloat(dom.portfolioPriceInput.value);
    const editingIndex = dom.addOrUpdatePortfolioBtn.getAttribute('data-editing-index');

    if (!code || isNaN(shares) || isNaN(purchasePrice) || shares <= 0 || purchasePrice <= 0) {
        alert('有効な企業コード、取得株数、購入単価を入力してください。');
        return;
    }

    if (editingIndex !== null) {
        myPortfolio[editingIndex].shares = shares;
        myPortfolio[editingIndex].purchasePrice = purchasePrice;
    } else {
        const existing = myPortfolio.findIndex(item => item.code === code);
        if (existing > -1) {
            myPortfolio[existing].shares = shares;
            myPortfolio[existing].purchasePrice = purchasePrice;
        } else {
            myPortfolio.push({ code, shares, purchasePrice });
        }
    }
    savePortfolio();
    renderPortfolio();
    if (myPortfolio.length > 0) {
        fetchData(myPortfolio.map(p => p.code).join(','), 'portfolio-container', true);
    } else {
        if(dom.portfolioContainer) dom.portfolioContainer.innerHTML = '';
    }
    clearPortfolioForm();
}


// --- Event Listeners ---

function attachEventListeners() {
    dom.fetchDataButton?.addEventListener('click', () => {
        const codes = dom.stockCodesInput.value.trim();
        if (codes) {
            fetchData(codes);
        } else {
            alert('株価・指数コードを入力してください。');
        }
    });

    dom.openPortfolioModalBtn?.addEventListener('click', () => openModal());
    dom.closeModalBtn?.addEventListener('click', closeModal);
    dom.cancelPortfolioModalBtn?.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target === dom.portfolioModal) closeModal();
    });

    dom.addOrUpdatePortfolioBtn?.addEventListener('click', handleAddOrUpdatePortfolio);
    dom.clearPortfolioFormBtn?.addEventListener('click', clearPortfolioForm);
    
    dom.modalFetchDataButton?.addEventListener('click', () => {
        const codes = dom.modalStockCodesInput.value.trim();
        if(codes) fetchModalData(codes);
    });

    dom.toggleAutoUpdateBtn?.addEventListener('click', toggleAutoUpdate);
    dom.updateIntervalSelect?.addEventListener('change', handleIntervalChange);
}

function attachPortfolioEventListeners() {
    document.querySelectorAll('.edit-portfolio-btn').forEach(button => {
        button.onclick = (e) => openModal(true, parseInt(e.target.dataset.index));
    });
    document.querySelectorAll('.delete-portfolio-btn').forEach(button => {
        button.onclick = (e) => {
            const index = parseInt(e.target.dataset.index);
            if (confirm(`${myPortfolio[index].code} をポートフォリオから削除しますか？`)) {
                myPortfolio.splice(index, 1);
                savePortfolio();
                renderPortfolio();
            }
        };
    });
}


// --- Data Fetching & Display ---

async function fetchData(codes, containerId = 'stock-container', isPortfolioUpdate = false) {
    if (!codes) return;
    if(dom.resultsLoading) dom.resultsLoading.style.display = 'block';

    if (!isPortfolioUpdate) {
        if(dom.indexForexContainer) dom.indexForexContainer.innerHTML = '';
        if(dom.stockContainer) dom.stockContainer.innerHTML = '';
    }

    try {
        const response = await fetch(`${WORKER_URL}?codes=${encodeURIComponent(codes)}`);
        const data = await response.json();
        if(dom.resultsLoading) dom.resultsLoading.style.display = 'none';
        if(dom.searchRawData) dom.searchRawData.textContent = `--- Data for codes: ${codes} (${new Date().toLocaleString()}) ---\n` + JSON.stringify(data, null, 2);

        if (response.ok && data.status === 'success' && Array.isArray(data.data.data)) {
            const targetContainer = isPortfolioUpdate ? dom.portfolioContainer : dom.stockContainer;
            if(isPortfolioUpdate && dom.portfolioContainer) dom.portfolioContainer.innerHTML = '';

            data.data.data.forEach(item => {
                const { name, code, update_time, current_value, bid_value, previous_day_change, change_rate } = item;
                const isForex = bid_value != null && current_value == null;
                const isIndex = code && (code.startsWith('^') || code.includes('.O'));
                
                const card = document.createElement('div');
                let cardHTML = '';
                let containerForCard = targetContainer;

                if (isForex || isIndex) {
                    card.className = isIndex ? 'index-card' : 'forex-card';
                    cardHTML = `
                        <h3>${name || 'N/A'} ${isIndex ? `(${code})` : ''}</h3>
                        <p><strong>現在の値:</strong> ${current_value || bid_value || 'N/A'}</p>
                        ${isIndex ? `<p><strong>前日比:</strong> ${previous_day_change || 'N/A'} (${change_rate || 'N/A'}%)</p>` : ''}
                        <p><strong>更新日時:</strong> ${update_time || 'N/A'}</p>
                    `;
                    if(!isPortfolioUpdate) containerForCard = dom.indexForexContainer;
                } else { // This is a stock card
                    card.className = 'stock-card';
                    let profitLossHTML = '';
                    let evaluationHTML = '';
                    let profitLossClass = '';

                    // Find the corresponding portfolio item
                    const portfolioItem = myPortfolio.find(p => p.code === code);

                    if (portfolioItem) {
                        const price = item.current_value !== null ? parseFloat(String(item.current_value).replace(/,/g, '')) : null;
                        if (typeof price === 'number' && !isNaN(price)) {
                            const investment = portfolioItem.shares * portfolioItem.purchasePrice;
                            const currentValue = price * portfolioItem.shares;
                            const profitLoss = currentValue - investment;
                            const profitLossPercentage = investment !== 0 ? (profitLoss / investment) * 100 : 0;

                            evaluationHTML = `<p><strong>評価額:</strong> ${currentValue.toLocaleString()}円</p>`;
                            profitLossClass = profitLoss > 0 ? 'positive' : (profitLoss < 0 ? 'negative' : '');
                            profitLossHTML = `<p><strong>評価損益:</strong> <span class="${profitLossClass}">${(profitLoss > 0 ? '+' : '') + profitLoss.toLocaleString()}円</span> (${(profitLossPercentage > 0 ? '+' : '') + profitLossPercentage.toFixed(2)}%)</p>`;
                        }
                    }

                    cardHTML = `
                        <h3>${name || 'N/A'} (${code || 'N/A'})</h3>
                        <p><strong>現在の株価:</strong> ${current_value || 'N/A'}円</p>
                        ${evaluationHTML}
                        ${profitLossHTML}
                        <p><strong>前日比:</strong> ${previous_day_change || 'N/A'} (${change_rate || 'N/A'}%)</p>
                        <p><strong>更新日時:</strong> ${update_time || 'N/A'}</p>
                    `;
                }
                
                const changeAmount = parseFloat(String(previous_day_change).replace(/,/g, ''));
                if (!isNaN(changeAmount)) {
                    if (changeAmount > 0) card.classList.add('daily-positive');
                    else if (changeAmount < 0) card.classList.add('daily-negative');
                }
                card.innerHTML = cardHTML;
                containerForCard?.appendChild(card);
            });
        }
    } catch (error) {
        console.error('Fetch error:', error);
        if(dom.resultsLoading) dom.resultsLoading.style.display = 'none';
    }
}

async function fetchModalData(codes) {
    if (!codes) return;
    if(dom.modalResultsLoading) dom.modalResultsLoading.style.display = 'block';
    if(dom.modalIndexForexContainer) dom.modalIndexForexContainer.innerHTML = '';
    if(dom.modalStockContainer) dom.modalStockContainer.innerHTML = '';
    if(dom.modalTotalProfitLoss) dom.modalTotalProfitLoss.textContent = '計算中...';

    try {
        const response = await fetch(`${WORKER_URL}?codes=${encodeURIComponent(codes)}`);
        const data = await response.json();
        if(dom.modalResultsLoading) dom.modalResultsLoading.style.display = 'none';

        if (response.ok && data.status === 'success' && Array.isArray(data.data.data)) {
            let totalProfitLoss = 0;
            data.data.data.forEach(item => {
                const { name, code, current_value, bid_value, previous_day_change, change_rate, update_time, status, message } = item;
                if (status === 'error') {
                    const card = document.createElement('div');
                    card.className = 'error-card-item';
                    card.innerHTML = `<p><strong>${code || '不明'}:</strong> ${message || 'エラー'}</p>`;
                    dom.modalStockContainer?.appendChild(card);
                    return;
                }

                const isForex = bid_value != null && current_value == null;
                const isIndex = code && (code.startsWith('^') || code.includes('.O'));
                const card = document.createElement('div');
                let cardHTML = '';
                let containerForCard;

                if (isForex || isIndex) {
                    card.className = isIndex ? 'index-card' : 'forex-card';
                    cardHTML = `<h3>${name}</h3><p><strong>値:</strong> ${current_value || bid_value}</p><p><strong>更新:</strong> ${update_time}</p>`;
                    containerForCard = dom.modalIndexForexContainer;
                } else {
                    card.className = 'stock-card';
                    const portfolioItem = myPortfolio.find(p => p.code === code);
                    let profitLossHTML = '';
                    if (portfolioItem) {
                        const price = parseFloat(String(current_value).replace(/,/g, ''));
                        if (!isNaN(price)) {
                            const profit = (price - portfolioItem.purchasePrice) * portfolioItem.shares;
                            totalProfitLoss += profit;
                            profitLossHTML = `<p>評価損益: <span class="${profit >= 0 ? 'positive' : 'negative'}">${profit.toLocaleString()}円</span></p>`;
                        }
                    }
                    cardHTML = `<h3>${name} (${code})</h3><p>株価: ${current_value}円</p><p>前日比: ${previous_day_change} (${change_rate}%)</p>${profitLossHTML}<p>更新: ${update_time}</p>`;
                    containerForCard = dom.modalStockContainer;
                }
                card.innerHTML = cardHTML;
                containerForCard?.appendChild(card);
            });
            if(dom.modalTotalProfitLoss) {
                dom.modalTotalProfitLoss.textContent = `合計評価損益: ${totalProfitLoss > 0 ? '+' : ''}${totalProfitLoss.toLocaleString()}円`;
                dom.modalTotalProfitLoss.className = totalProfitLoss >= 0 ? 'positive' : 'negative';
            }
        }
    } catch (error) {
        console.error('Modal fetch error:', error);
    }
}

// --- Auto Update --- 
function toggleAutoUpdate() {
    isAutoUpdateActive = !isAutoUpdateActive;
    const toggleBtn = document.getElementById('toggle-auto-update-btn');
    const codes = myPortfolio.map(item => item.code).join(',');

    if (isAutoUpdateActive && codes) {
        toggleBtn.textContent = 'Stop Auto Update';
        toggleBtn.classList.add('active');
        const intervalSeconds = parseInt(dom.updateIntervalSelect.value, 10);
        timeRemaining = intervalSeconds;
        fetchData(codes, 'portfolio-container', true);
        autoUpdateIntervalId = setInterval(() => {
            timeRemaining = intervalSeconds;
            fetchData(codes, 'portfolio-container', true);
        }, intervalSeconds * 1000);
        if(countdownIntervalId) clearInterval(countdownIntervalId);
        countdownIntervalId = setInterval(updateCountdownDisplay, 1000);
    } else {
        toggleBtn.textContent = 'Start Auto Update';
        toggleBtn.classList.remove('active');
        if (autoUpdateIntervalId) clearInterval(autoUpdateIntervalId);
        if (countdownIntervalId) clearInterval(countdownIntervalId);
        if(dom.countdownDisplay) dom.countdownDisplay.textContent = '';
        if (!codes) alert('ポートフォリオに銘柄が登録されていません。');
    }
}

function handleIntervalChange() {
    if (isAutoUpdateActive) {
        isAutoUpdateActive = false; 
        toggleAutoUpdate(); 
        toggleAutoUpdate(); 
    }
}

function updateCountdownDisplay() {
    if (timeRemaining > 0) {
        dom.countdownDisplay.textContent = `Next update in ${timeRemaining--}s`;
    } else {
        dom.countdownDisplay.textContent = 'Updating...';
    }
}


// --- Initialization ---

function init() {
    cacheDOMElements();
    attachEventListeners();
    
    fetchData('^DJI,998407,USDJPY=FX');
    loadPortfolio();
    if (myPortfolio.length > 0) {
        fetchData(myPortfolio.map(p => p.code).join(','), 'portfolio-container', true);
    }
}

document.addEventListener('DOMContentLoaded', init);