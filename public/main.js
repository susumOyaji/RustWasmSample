// main.js

// ポートフォリオデータを格納する配列をトップレベルで宣言
let myPortfolio = [];

// 自動更新の状態を管理する変数
let isAutoUpdateActive = false;
let autoUpdateIntervalId = null;
let countdownIntervalId = null;
let timeRemaining = 0;

// Pages Functionのエンドポイントを設定します。
const WORKER_URL = '/worker-data';

// DOM要素の参照をグローバルまたは適切なスコープで保持
let portfolioCodeInput;
let portfolioSharesInput;
let portfolioPriceInput;
let addOrUpdatePortfolioBtn;
let clearPortfolioFormBtn; // 新しく追加された「入力クリア」ボタン用
// モーダル関連のDOM要素を再追加
let portfolioModal;
let closeButton;
let openPortfolioModalBtn; // メイン画面の「ポートフォリオを見る / 編集」ボタン
let cancelPortfolioModalBtn; // モーダル内の「キャンセル」ボタン

// ----------------------------------------------------
// ポートフォリオ管理関連の関数
// ----------------------------------------------------

/**
 * ポートフォリオをlocalStorageから読み込む
 */
function loadPortfolio() {
    const storedPortfolio = localStorage.getItem('myPortfolio');
    if (storedPortfolio && JSON.parse(storedPortfolio).length > 0) {
        myPortfolio = JSON.parse(storedPortfolio);
    } else {
        // ポートフォリオが空、または存在しない場合
        myPortfolio = [];
        // 少し遅延させてモーダルを開くことで、ページの他の部分の準備が整うのを待つ
        setTimeout(() => {
            openModal(); // ポートフォリオ管理モーダルを開く
            alert('ポートフォリオに銘柄が登録されていません。銘柄を登録してください。');
        }, 500); // 500ミリ秒の遅延
    }
}

/**
 * ポートフォリオをlocalStorageに保存する
 */
function savePortfolio() {
    localStorage.setItem('myPortfolio', JSON.stringify(myPortfolio));
}

/**
 * モーダルを開く
 * @param {boolean} isEditMode - 編集モードかどうか (true: 編集, false: 新規追加)
 * @param {number} itemIndex - 編集対象のインデックス (編集モードの場合のみ)
 */
function openModal(isEditMode = false, itemIndex = -1) {
    if (!portfolioModal) {
        console.error('モーダル要素が見つかりません。');
        return;
    }
    portfolioModal.style.display = 'flex'; // flexで中央寄せ
    document.body.style.overflow = 'hidden'; // 背景のスクロールを禁止

    // モーダルを開くたびにポートフォリオテーブルを再描画
    renderPortfolio();

    const fetchDataButton = document.getElementById('modalFetchDataButton');
    const stockCodesInput = document.getElementById('modalStockCodesInput');
    if (fetchDataButton && stockCodesInput) {
        fetchDataButton.onclick = () => {
            const codes = stockCodesInput.value.trim();
            if (!codes) {
                alert('株価・指数コードを入力してください。');
                return;
            }
            fetchModalData(codes); // モーダル内の要素をターゲットにする
        };
    }

    if (isEditMode && itemIndex !== -1) {
        const itemToEdit = myPortfolio[itemIndex];
        portfolioCodeInput.value = itemToEdit.code;
        portfolioSharesInput.value = itemToEdit.shares;
        portfolioPriceInput.value = itemToEdit.purchasePrice;
        addOrUpdatePortfolioBtn.textContent = '更新を保存';
        addOrUpdatePortfolioBtn.setAttribute('data-editing-index', itemIndex);
        portfolioCodeInput.disabled = true; // 編集時はコード変更不可
    } else {
        clearPortfolioForm(); // 新規追加の場合はフォームをクリア
        addOrUpdatePortfolioBtn.textContent = '銘柄を追加 / 更新'; // 新規追加モードのボタンテキスト
        addOrUpdatePortfolioBtn.removeAttribute('data-editing-index');
        portfolioCodeInput.disabled = false; // 新規追加時はコード変更可能
    }
}

/**
 * モーダルを閉じる
 */
function closeModal() {
    if (portfolioModal) {
        portfolioModal.style.display = 'none';
    }
    document.body.style.overflow = ''; // 背景のスクロールを許可
    clearPortfolioForm(); // フォームをクリア
}

/**
 * ポートフォリオアイテムをレンダリングする関数
 * この関数はDOM要素にアクセスするため、init()の後に呼び出す必要があります。
 */
async function renderPortfolio() {
    // この関数はモーダルが開かれた時にのみ呼び出される想定
    const portfolioTableBody = document.querySelector('#portfolioTable tbody');
    const portfolioTotalValueSpan = document.getElementById('portfolioTotalValue');
    const portfolioTotalProfitSpan = document.getElementById('portfolioTotalProfit');

    if (!portfolioTableBody || !portfolioTotalValueSpan || !portfolioTotalProfitSpan) {
        console.warn('ポートフォリオ関連のDOM要素が見つかりません。モーダルが開かれているか確認してください。');
        return;
    }

    portfolioTableBody.innerHTML = ''; // 一旦テーブルをクリア
    let totalCurrentValue = 0;
    let totalInvestment = 0;

    // 現在株価取得のために、ポートフォリオ内の全銘柄コードを収集
    const codesToFetch = myPortfolio.map(item => item.code).join(',');

    let currentPrices = {}; // { 'CODE': { current_price: '...', change_amount: '...' }, ...}

    // 株価情報がなければ取得を試みる
    if (codesToFetch) {
        try {
            const response = await fetch(`${WORKER_URL}?codes=${encodeURIComponent(codesToFetch)}`);
            const data = await response.json();

            if (response.ok && data.status === 'success' && Array.isArray(data.data.data) && data.data.data.length > 0) {
                data.data.data.forEach(item => {
                    if (item.status !== 'error') { // 正常にデータが取得できたもののみ
                        currentPrices[item.company_code || item.symbol] = {
                            current_price: parseFloat(String(item.current_price).replace(/,/g, '')), // カンマ除去して数値に変換
                            change_amount: parseFloat(String(item.change_amount || '0').replace(/,/g, ''))
                        };
                    }
                });
            }
        } catch (error) {
            console.error('ポートフォリオの株価取得に失敗:', error);
            // エラー時でも、既存のデータで計算を続行
        }
    }

    myPortfolio.forEach((item, index) => {
        const row = portfolioTableBody.insertRow();
        const currentPriceInfo = currentPrices[item.code] || { current_price: 'N/A', change_amount: 'N/A' };
        const currentPrice = !isNaN(currentPriceInfo.current_price) ? currentPriceInfo.current_price : 'N/A';

        let currentValue = 'N/A';
        let profitLoss = 'N/A';
        let profitLossPercentage = 'N/A';
        let profitLossClass = '';

        const investment = item.shares * item.purchasePrice;

        if (typeof currentPrice === 'number') {
            currentValue = currentPrice * item.shares;
            profitLoss = currentValue - investment;
            profitLossPercentage = (profitLoss / investment) * 100;

            totalCurrentValue += currentValue;
            totalInvestment += investment;

            if (profitLoss > 0) {
                profitLossClass = 'positive';
            } else if (profitLoss < 0) {
                profitLossClass = 'negative';
            } else {
                profitLossClass = 'zero';
            }
        }

        row.innerHTML = `
            <td data-label="企業コード">${item.code}</td>
            <td data-label="取得株数">${item.shares.toLocaleString()}株</td>
            <td data-label="購入単価">${item.purchasePrice.toLocaleString()}円</td>
            <td data-label="現在株価">${typeof currentPrice === 'number' ? currentPrice.toLocaleString() + '円' : currentPrice}</td>
            <td data-label="評価額">${typeof currentValue === 'number' ? currentValue.toLocaleString() + '円' : currentValue}</td>
            <td data-label="評価損益" class="${profitLossClass}">${typeof profitLoss === 'number' ? (profitLoss > 0 ? '+' : '') + profitLoss.toLocaleString() + '円' : profitLoss}</td>
            <td data-label="損益率" class="${profitLossClass}">${typeof profitLossPercentage === 'number' ? (profitLossPercentage > 0 ? '+' : '') + profitLossPercentage.toFixed(2) + '%' : profitLossPercentage}</td>
            <td data-label="操作">
                <button data-index="${index}" class="edit-portfolio-btn">編集</button>
                <button data-index="${index}" class="delete-portfolio-btn" style="background-color: hsl(var(--error));">削除</button>
            </td>
        `;
    });

    // 合計値を表示
    if (portfolioTotalValueSpan) {
        portfolioTotalValueSpan.textContent = `合計評価額: ${totalCurrentValue.toLocaleString()}円`;
    }
    const totalProfitLoss = totalCurrentValue - totalInvestment;
    let totalProfitClass = '';
    if (totalProfitLoss > 0) {
        totalProfitClass = 'positive';
    } else if (totalProfitLoss < 0) {
        totalProfitClass = 'negative';
    } else {
        totalProfitClass = 'zero';
    }
    if (portfolioTotalProfitSpan) {
        portfolioTotalProfitSpan.textContent = `合計評価損益: ${totalProfitLoss > 0 ? '+' : ''}${totalProfitLoss.toLocaleString()}円`;
        portfolioTotalProfitSpan.className = totalProfitClass; // クラスを適用
    }

    attachPortfolioEventListeners(); // イベントリスナーを再設定
}

/**
 * ポートフォリオフォームの入力クリア
 */
function clearPortfolioForm() {
    if (portfolioCodeInput) portfolioCodeInput.value = '';
    if (portfolioSharesInput) portfolioSharesInput.value = '100'; // デフォルト値に戻す
    if (portfolioPriceInput) portfolioPriceInput.value = '1000'; // デフォルト値に戻す
    if (addOrUpdatePortfolioBtn) {
        addOrUpdatePortfolioBtn.textContent = '銘柄を追加 / 更新'; // ボタンテキストを元に戻す
        addOrUpdatePortfolioBtn.removeAttribute('data-editing-index'); // 編集モードを解除
    }
    if (portfolioCodeInput) portfolioCodeInput.disabled = false; // 新規追加モードではコード変更可能にする
}

/**
 * 編集・削除ボタンのイベントリスナーを設定
 */
function attachPortfolioEventListeners() {
    document.querySelectorAll('.edit-portfolio-btn').forEach(button => {
        button.onclick = (event) => {
            const index = parseInt(event.target.dataset.index);
            openModal(true, index); // 編集モードでモーダルを開く
        };
    });

    document.querySelectorAll('.delete-portfolio-btn').forEach(button => {
        button.onclick = (event) => {
            const index = parseInt(event.target.dataset.index);
            if (confirm(`${myPortfolio[index].code} をポートフォリオから削除しますか？`)) {
                myPortfolio.splice(index, 1); // 配列から削除
                savePortfolio(); // 保存
                renderPortfolio(); // 再描画 (モーダル内を更新)
                clearPortfolioForm(); // フォームもクリア
            }
        };
    });
}

// ----------------------------------------------------
// 自動更新機能
// ----------------------------------------------------

/**
 * 自動更新のオン/オフを切り替える
 */
function toggleAutoUpdate() {
    isAutoUpdateActive = !isAutoUpdateActive;
    const toggleBtn = document.getElementById('toggle-auto-update-btn');
    const codes = myPortfolio.map(item => item.code).join(',');

    if (isAutoUpdateActive) {
        toggleBtn.textContent = 'Stop Auto Update';
        toggleBtn.classList.add('active');
        if (codes) {
            const intervalSeconds = parseInt(document.getElementById('update-interval').value, 10);
            timeRemaining = intervalSeconds;
            fetchMainData(codes, 'portfolio-container'); // ポートフォリオコンテナを更新
            autoUpdateIntervalId = setInterval(() => {
                timeRemaining = intervalSeconds;
                fetchMainData(codes, 'portfolio-container'); // ポートフォリオコンテナを更新
            }, intervalSeconds * 1000);
            if (countdownIntervalId) clearInterval(countdownIntervalId);
            countdownIntervalId = setInterval(updateCountdownDisplay, 1000);
        } else {
            alert('ポートフォリオに銘柄が登録されていません。自動更新を開始できません。');
            isAutoUpdateActive = false;
            toggleBtn.textContent = 'Start Auto Update';
            toggleBtn.classList.remove('active');
        }
    } else {
        toggleBtn.textContent = 'Start Auto Update';
        toggleBtn.classList.remove('active');
        if (autoUpdateIntervalId) clearInterval(autoUpdateIntervalId);
        if (countdownIntervalId) clearInterval(countdownIntervalId);
        document.getElementById('countdown-display').textContent = '';
    }
}

/**
 * 更新間隔が変更されたときに自動更新を再開する
 */
function handleIntervalChange() {
    if (isAutoUpdateActive) {
        if (autoUpdateIntervalId) clearInterval(autoUpdateIntervalId);
        if (countdownIntervalId) clearInterval(countdownIntervalId);
        const toggleBtn = document.getElementById('toggle-auto-update-btn');
        toggleBtn.textContent = 'Stop Auto Update';
        toggleBtn.classList.add('active');
        const codes = myPortfolio.map(item => item.code).join(',');
        if (codes) {
            const intervalSeconds = parseInt(document.getElementById('update-interval').value, 10);
            timeRemaining = intervalSeconds;
            fetchMainData(codes, 'portfolio-container'); // ポートフォリオコンテナを更新
            autoUpdateIntervalId = setInterval(() => {
                timeRemaining = intervalSeconds;
                fetchMainData(codes, 'portfolio-container'); // ポートフォリオコンテナを更新
            }, intervalSeconds * 1000);
            countdownIntervalId = setInterval(updateCountdownDisplay, 1000);
        } else {
            alert('ポートフォリオに銘柄が登録されていません。自動更新を再開できません。');
            isAutoUpdateActive = false;
            toggleBtn.textContent = 'Start Auto Update';
            toggleBtn.classList.remove('active');
        }
    }
}

/**
 * カウントダウン表示を更新する
 */
function updateCountdownDisplay() {
    const display = document.getElementById('countdown-display');
    if (timeRemaining > 0) {
        display.textContent = `Next update in ${timeRemaining}s`;
        timeRemaining--;
    } else {
        display.textContent = 'Updating...';
    }
}

// ----------------------------------------------------
// メインのデータ取得機能 (直接ページに表示)
// ----------------------------------------------------

/**
 * データを取得してページ内の指定の領域に表示する非同期関数
 * @param {string} codes - 取得する株価・指数コードのカンマ区切り文字列
 * @param {string} target - 出力先のプレフィックス ('' or 'modal-')
 */
async function fetchMainData(codes, targetContainerId = 'stock-container') {
    console.log(`fetchMainData called with codes: ${codes} for container: ${targetContainerId}`);
    // データ表示用のDOM要素を取得
    const resultsLoadingDiv = document.getElementById(`resultsLoading`);
    const targetContainer = document.getElementById(targetContainerId);
    const searchRawDataPre = document.getElementById(`searchRawData`);

    if (!targetContainer) {
        console.error(`Target container with ID ${targetContainerId} not found.`);
        return;
    }

    // 要素が存在するかチェック
    if (!resultsLoadingDiv || !searchRawDataPre) {
        console.error('データ表示用のDOM要素が見つかりません。');
        return;
    }

    if (!codes) {
        targetContainer.innerHTML = '<p>表示する株価・指数コードが指定されていません。</p>';
        return;
    }

    // ローディング状態にする
    resultsLoadingDiv.style.display = 'block';
    if (targetContainer.innerHTML === '') { // コンテナが空の場合のみクリア
        targetContainer.innerHTML = '';
    }

    try {
        const urlToFetch = `${WORKER_URL}?codes=${encodeURIComponent(codes)}`;
        const response = await fetch(urlToFetch);
        const data = await response.json();
        console.log(`API Response for ${codes}:`, data);

        resultsLoadingDiv.style.display = 'none'; // ローディング表示を非表示に
        searchRawDataPre.textContent = JSON.stringify(data, null, 2); // デバッグ用に生データを表示

        if (response.ok && data.status === 'success') {
            const fetchedItems = data.data.data;
            console.log(`Fetched items for ${codes}:`, fetchedItems);

            if (Array.isArray(fetchedItems) && fetchedItems.length > 0) {
                // コンテナをクリア
                targetContainer.innerHTML = '';

                fetchedItems.forEach(item => {
                    let card;
                    // Map the provided JSON keys to the expected keys for card rendering
                    const companyName = item.name || 'N/A';
                    const companyCode = item.code || 'N/A';
                    const updateTime = item.update_time || 'N/A';
                    const currentValue = item.current_value || 'N/A';
                    const previousDayChange = item.previous_day_change || 'N/A';
                    const changeRate = item.change_rate || 'N/A';

                    card = document.createElement('div');
                    card.className = 'stock-card';

                    // 前日比による背景色クラス
                    const changeAmount = parseFloat(String(previousDayChange).replace(/,/g, ''));
                    if (!isNaN(changeAmount)) {
                        if (changeAmount > 0) {
                            card.classList.add('daily-positive');
                        } else if (changeAmount < 0) {
                            card.classList.add('daily-negative');
                        } else {
                            card.classList.add('daily-zero-change');
                        }
                    }

                    card.innerHTML = `
                        <h3>${companyName} (${companyCode})</h3>
                        <p><strong>現在の株価:</strong> ${currentValue}円</p>
                        <p><strong>前日比:</strong> ${previousDayChange} (${changeRate}%)</p>
                        <p><strong>更新日時:</strong> ${updateTime}</p>
                        <p><strong>ソース:</strong> ${data.source || 'N/A'}</p>
                    `;
                    targetContainer.appendChild(card);
                    console.log(`Appended stock card to ${targetContainerId}:`, card);
                });
            } else {
                targetContainer.innerHTML = '<p>指定されたコードのデータは見つかりませんでした。</p>';
            }
        } else {
            targetContainer.innerHTML = `<p style="color:red;">APIエラー: ${data.message || response.statusText || '不明なエラー'}</p>`;
        }

    } catch (error) {
        console.error('データの取得に失敗しました:', error);
        resultsLoadingDiv.style.display = 'none';
        targetContainer.innerHTML = `<p style="color:red;">ネットワークエラー: ${error.message}</p>`;
    }
}

/**
 * データを取得してモーダル内の指定の領域に表示する非同期関数
 * @param {string} codes - 取得する株価・指数コードのカンマ区切り文字列
 */
async function fetchModalData(codes) {
    console.log(`fetchModalData called with codes: ${codes}`);
    // データ表示用のDOM要素を取得
    const resultsLoadingDiv = document.getElementById(`modal-resultsLoading`);
    const searchResultsDiv = document.getElementById(`modal-search-results-container`);
    const searchRawDataPre = document.getElementById(`modal-searchRawData`);
    const totalSearchResultsProfitLossSpan = document.getElementById(`modal-totalSearchResultsProfitLoss`); // 新しい要素
    const searchResultsSection = document.getElementById(`modal-searchResultsSection`);
    

    if(searchResultsSection) {
        searchResultsSection.style.display = 'block';
        console.log('modalSearchResultsSection display after setting to block:', searchResultsSection.style.display); // Added console.log
    }

    // 要素が存在するかチェック
    if (!resultsLoadingDiv || !searchResultsDiv || !searchRawDataPre || !totalSearchResultsProfitLossSpan) {
        console.error('モーダル内のデータ表示用のDOM要素が見つかりません。');
        return;
    }

    if (!codes) {
        searchResultsDiv.innerHTML = '<p>表示する株価・指数コードが指定されていません。</p>';
        resultsLoadingDiv.style.display = 'none';
        searchRawDataPre.textContent = '';
        totalSearchResultsProfitLossSpan.textContent = '検索結果の合計評価損益: 計算中...'; // クリア
        totalSearchResultsProfitLossSpan.className = ''; // クラスもクリア
        return;
    }

    // ローディング状態にする
    resultsLoadingDiv.style.display = 'block';
    searchResultsDiv.innerHTML = '';
    searchRawDataPre.textContent = '';
    totalSearchResultsProfitLossSpan.textContent = '検索結果の合計評価損益: 計算中...'; // クリア
    totalSearchResultsProfitLossSpan.className = '';


    let totalProfitLossFromSearchResults = 0; // 検索結果の合計評価損益を格納する変数

    try {
        const urlToFetch = `${WORKER_URL}?codes=${encodeURIComponent(codes)}`;
        const response = await fetch(urlToFetch);
            const data = await response.json();
            console.log(`API Response for ${codes}:`, data);

        resultsLoadingDiv.style.display = 'none'; // ローディング表示を非表示に
        searchRawDataPre.textContent = JSON.stringify(data, null, 2); // デバッグ用に生データを表示

        if (response.ok && data.status === 'success') {
            const fetchedItems = data.data.data;
            console.log(`Fetched items for ${codes}:`, fetchedItems);

            if (Array.isArray(fetchedItems) && fetchedItems.length > 0) {
                const indexForexContainer = document.getElementById(`modal-index-forex-container`);
                const stockContainer = document.getElementById(`modal-stock-container`);
                console.log(`Target indexForexContainer:`, indexForexContainer);
                console.log(`Target stockContainer:`, stockContainer);

                // コンテナをクリア
                if(indexForexContainer) indexForexContainer.innerHTML = '';
                if(stockContainer) stockContainer.innerHTML = '';

                fetchedItems.forEach(item => {
                    let card;
                    if (item.status === 'error') {
                        console.log(`Creating error card for:`, item);
                        card = document.createElement('div');
                        card.className = 'error-card-item';
                        card.innerHTML = `
                            <p><strong>コード:</strong> ${item.symbol || item.company_code || '不明'}</p>
                            <p><strong>エラー:</strong> ${item.message || 'データ取得失敗'}</p>
                        `;
                        // エラーカードはどちらか適切な方、または両方に追加できます。
                        // ここではstockContainerに追加する例を示します。
                        if(stockContainer) stockContainer.appendChild(card);

                    } else if (item.type === 'stock') {
                        console.log(`Creating stock card for:`, item);
                        card = document.createElement('div');
                        card.className = 'stock-card';

                        // 評価損益の計算ロジック (合計用)
                        const portfolioItem = myPortfolio.find(pItem => pItem.code === (item.company_code || item.symbol));

                        let shares = 0;
                        let purchasePrice = 0;
                        let currentItemProfitLoss = 0; // 各アイテムの評価損益

                        if (portfolioItem) {
                            shares = portfolioItem.shares;
                            purchasePrice = portfolioItem.purchasePrice;
                            const currentPrice = parseFloat(String(item.current_price).replace(/,/g, ''));

                            if (!isNaN(currentPrice) && shares > 0) {
                                currentItemProfitLoss = (currentPrice * shares) - (purchasePrice * shares);
                                totalProfitLossFromSearchResults += currentItemProfitLoss; // 合計に加算
                            }
                        }

                        // 前日比による背景色クラス
                        const changeAmount = parseFloat(String(item.change_amount || '0').replace(/,/g, ''));
                        if (!isNaN(changeAmount)) {
                            if (changeAmount > 0) {
                                card.classList.add('daily-positive');
                            } else if (changeAmount < 0) {
                                card.classList.add('daily-negative');
                            } else {
                                card.classList.add('daily-zero-change');
                            }
                        }

                        card.innerHTML = `
                            <h3>${item.company_name || 'N/A'} (${item.company_code || 'N/A'})</h3>
                            <p><strong>現在の株価:</strong> ${item.current_price || 'N/A'}円</p>
                            ${portfolioItem ? `<p><strong>ポートフォリオ:</strong> ${shares.toLocaleString()}株 (取得単価: ${purchasePrice.toLocaleString()}円)</p>` : ''}
                            <p><strong>前日比:</strong> ${item.change_amount || 'N/A'} (${item.change_percentage || 'N/A'})</p>
                            <p><strong>更新日時:</strong> ${item.update_time || 'N/A'}</p>
                            <p><strong>ソース:</strong> ${item.source || 'N/A'}</p>
                        `;
                        if(stockContainer) {
                            stockContainer.appendChild(card);
                            console.log(`Appended stock card to stockContainer:`, card); // Added console.log
                        }

                    } else if (item.type === 'index' || item.type === 'forex') {
                        console.log(`Creating ${item.type} card for:`, item);
                        card = document.createElement('div');
                        card.className = item.type === 'index' ? 'index-card' : 'forex-card';
                        const changeAmount = parseFloat(String(item.change_amount || '0').replace(/,/g, ''));
                        if (!isNaN(changeAmount)) {
                            if (changeAmount > 0) {
                                card.classList.add('daily-positive');
                            } else if (changeAmount < 0) {
                                card.classList.add('daily-negative');
                            } else {
                                card.classList.add('daily-zero-change');
                            }
                        }
                        card.innerHTML = `
                            <h3>${item.index_name || item.currency_pair || 'N/A'} (${item.symbol || 'N/A'})</h3>
                            <p><strong>現在の値:</strong> ${item.current_price || 'N/A'}</p>
                            ${item.type === 'forex' ? '' : `<p><strong>前日比:</strong> ${item.change_amount || 'N/A'} (${item.change_percentage || 'N/A'})</p>`}
                            <p><strong>更新日時:</b> ${item.update_time || 'N/A'}</p>
                            <p><strong>ソース:</strong> ${item.source || 'N/A'}</p>
                        `;
                        // This now correctly uses the already-prefixed indexForexContainer
                        if(indexForexContainer) {
                            indexForexContainer.appendChild(card);
                            console.log(`Appended ${item.type} card to indexForexContainer:`, card); // Added console.log
                        }
                    }
                });

                // 検索結果の合計評価損益を表示
                let totalSearchResultsProfitLossClass = '';
                if (totalProfitLossFromSearchResults > 0) {
                    totalSearchResultsProfitLossClass = 'positive';
                } else if (totalProfitLossFromSearchResults < 0) {
                    totalSearchResultsProfitLossClass = 'negative';
                } else {
                    totalSearchResultsProfitLossClass = 'zero';
                }
                totalSearchResultsProfitLossSpan.textContent = `検索結果の合計評価損益: ${totalProfitLossFromSearchResults > 0 ? '+' : ''}${totalProfitLossFromSearchResults.toLocaleString()}円`;
                totalSearchResultsProfitLossSpan.className = totalSearchResultsProfitLossClass; // クラスを適用

            } else {
                searchResultsDiv.innerHTML = '<p>指定されたコードのデータは見つかりませんでした。</p>';
                totalSearchResultsProfitLossSpan.textContent = '検索結果の合計評価損益: データなし';
                totalSearchResultsProfitLossSpan.className = '';
            }
        } else {
            searchResultsDiv.innerHTML = `<p style="color:red;">APIエラー: ${data.message || response.statusText || '不明なエラー'}</p>`;
            totalSearchResultsProfitLossSpan.textContent = '検索結果の合計評価損益: エラー';
            totalSearchResultsProfitLossSpan.className = 'negative'; // エラー時は赤色にすることも可能
        }

    } catch (error) {
        console.error('データの取得に失敗しました:', error);
        resultsLoadingDiv.style.display = 'none';
        searchResultsDiv.innerHTML = `<p style="color:red;">ネットワークエラー: ${error.message}</p>`;
        totalSearchResultsProfitLossSpan.textContent = `検索結果の合計評価損益: ネットワークエラー (${error.message})`;
        totalSearchResultsProfitLossSpan.className = 'negative';
    }
}

// ----------------------------------------------------
// 初期化関数
// ----------------------------------------------------
function init() {
    // 必要な要素の取得
    const fetchDataButton = document.getElementById('fetchDataButton');
    const stockCodesInput = document.getElementById('stockCodesInput');

    // イベントリスナー登録
    if (fetchDataButton && stockCodesInput) {
        fetchDataButton.addEventListener('click', () => {
            const codes = stockCodesInput.value.trim();
            if (codes) {
                fetchMainData(codes);
            } else {
                alert('株価・指数コードを入力してください。');
            }
        });
    }

    // 自動更新UIの要素を取得
    const toggleAutoUpdateBtn = document.getElementById('toggle-auto-update-btn');
    const updateIntervalSelect = document.getElementById('update-interval');

    // グローバル変数にDOM要素への参照を保存
    portfolioCodeInput = document.getElementById('portfolioCode');
    portfolioSharesInput = document.getElementById('portfolioShares');
    portfolioPriceInput = document.getElementById('portfolioPrice');
    addOrUpdatePortfolioBtn = document.getElementById('addOrUpdatePortfolioBtn');
    clearPortfolioFormBtn = document.getElementById('clearPortfolioFormBtn'); // 「入力クリア」ボタン

    // モーダル関連の要素を初期化時に取得
    portfolioModal = document.getElementById('portfolioModal');
    closeButton = document.querySelector('.close-button'); // モーダル内の閉じるボタン
    openPortfolioModalBtn = document.getElementById('openPortfolioModalBtn'); // メイン画面のボタン
    cancelPortfolioModalBtn = document.getElementById('cancelPortfolioModalBtn'); // モーダル内のキャンセルボタン


    const searchRawDataPre = document.getElementById('searchRawData');
    if (searchRawDataPre) {
        searchRawDataPre.textContent = 'ここにAPIからの生データが表示されます。';
    }

    // イベントリスナー登録
    

    // 自動更新ボタンのイベントリスナー
    if (toggleAutoUpdateBtn) {
        toggleAutoUpdateBtn.addEventListener('click', toggleAutoUpdate);
    }

    // 更新間隔セレクトボックスのイベントリスナー
    if (updateIntervalSelect) {
        updateIntervalSelect.addEventListener('change', handleIntervalChange);
    }

    // 「銘柄を追加 / 更新」ボタン (モーダル内のボタン)
    if (addOrUpdatePortfolioBtn && portfolioCodeInput && portfolioSharesInput && portfolioPriceInput) {
        addOrUpdatePortfolioBtn.addEventListener('click', () => {
            const code = portfolioCodeInput.value.trim().toUpperCase();
            const shares = parseInt(portfolioSharesInput.value);
            const price = parseFloat(portfolioPriceInput.value);

            if (!code || isNaN(shares) || shares <= 0 || isNaN(price) || price <= 0) {
                alert('企業コード、取得株数、購入単価を正しく入力してください。');
                return;
            }

            const editingIndex = addOrUpdatePortfolioBtn.getAttribute('data-editing-index');

            if (editingIndex !== null) { // 編集モード
                myPortfolio[parseInt(editingIndex)] = { code, shares, purchasePrice: price };
            } else { // 新規追加モード
                const existingItemIndex = myPortfolio.findIndex(item => item.code === code);
                if (existingItemIndex !== -1) {
                    if (confirm(`${code} は既にポートフォリオに存在します。取得株数と購入単価を更新しますか？`)) {
                        myPortfolio[existingItemIndex].shares = shares;
                        myPortfolio[existingItemIndex].purchasePrice = price;
                    } else {
                        return;
                    }
                } else {
                    myPortfolio.push({ code, shares, purchasePrice: price, purchaseDate: new Date().toISOString().split('T')[0] });
                }
            }

            savePortfolio();
            // ポートフォリオ更新後、モーダル内の表示を更新する
            renderPortfolio();
            // フォームをクリア (モーダルは閉じない。連続操作のため)
            clearPortfolioForm();
        });
    }

    // 「入力クリア」ボタン (モーダル内のボタン)
    if (clearPortfolioFormBtn) {
        clearPortfolioFormBtn.addEventListener('click', clearPortfolioForm);
    }

    // 「ポートフォリオを見る / 編集」ボタン (メインページにある)
    if (openPortfolioModalBtn) {
        openPortfolioModalBtn.addEventListener('click', () => openModal(false)); // 新規追加モード (最初は編集フォームをクリアするため)
    }

    // モーダルの閉じるボタン
    if (closeButton) {
        closeButton.addEventListener('click', closeModal);
    }

    // モーダルのキャンセルボタン
    if (cancelPortfolioModalBtn) {
        cancelPortfolioModalBtn.addEventListener('click', closeModal);
    }

    // モーダル外クリックで閉じる
    if (portfolioModal) {
        window.addEventListener('click', (event) => {
            if (event.target === portfolioModal) {
                closeModal();
            }
        });
    }

    // --- 初期化処理 ---

    // 1. デフォルトで主要指数、指定コード、為替レートを表示
    fetchMainData('^DJI,998407,USDJPY=FX', 'stock-container');

    // 2. ポートフォリオをロード
    loadPortfolio();

    // 3. ポートフォリオがあれば、ポートフォリオエリアに表示
    if (myPortfolio.length > 0) {
        const portfolioCodes = myPortfolio.map(item => item.code).join(',');
        fetchMainData(portfolioCodes, 'portfolio-container');
    }
}

// ページロード時にinit()を呼ぶ
document.addEventListener('DOMContentLoaded', init);
