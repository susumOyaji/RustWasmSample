document.addEventListener('DOMContentLoaded', () => {
    const WORKER_URL = '/worker-data';
    const UPDATE_INTERVAL_SECONDS = 60; // 更新間隔（秒）

    const cardContainer = document.getElementById('card-container');
    const lastSearchedCardContainer = document.getElementById('last-searched-card-container');
    const rawDataDisplay = document.getElementById('raw-data-display');

    // ポップアップ関連の要素
    const popupOverlay = document.getElementById('popup-overlay');
    const popupModal = document.getElementById('popup-modal');
    const popupContent = document.getElementById('popup-content');
    const popupCloseBtn = document.getElementById('popup-close-btn');

    // 自動更新関連の要素
    const autoUpdateCheckbox = document.getElementById('auto-update-checkbox');
    const updateCountdownSpan = document.getElementById('update-countdown');

    // --- 保有株管理機能関連の要素と変数（DOMContentLoadedの先頭に移動）---
    const portfolioForm = document.getElementById('portfolio-form');
    const portfolioTableBody = document.querySelector('#portfolio-table tbody');
    const portfolioIdInput = document.getElementById('portfolio-id');
    const portfolioCodeInput = document.getElementById('portfolio-code');
    const portfolioSharesInput = document.getElementById('portfolio-shares');
    const portfolioPriceInput = document.getElementById('portfolio-price');

    let portfolio = JSON.parse(localStorage.getItem('portfolio')) || [];

    let updateIntervalId; // setIntervalのIDを保持
    let countdown = UPDATE_INTERVAL_SECONDS; // カウントダウンタイマー

    // ポップアップを開く関数
    function openPopup(item) {
        popupContent.innerHTML = `<pre>${JSON.stringify(item, null, 2)}</pre>`;
        popupOverlay.classList.remove('hidden');
        popupModal.classList.remove('hidden');
    }

    // ポップアップを閉じる関数
    function closePopup() {
        popupOverlay.classList.add('hidden');
        popupModal.classList.add('hidden');
    }

    // 生データを表示する関数
    function updateRawDataDisplay(data) {
        rawDataDisplay.textContent = JSON.stringify(data, null, 2);
        rawDataDisplay.style.display = 'block';
        console.log('Received data:', rawDataDisplay.textContent);
    }

    // カードを生成して指定されたコンテナに追加するヘルパー関数
    function createAndAppendCard(item, targetContainer) {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('financial-card');

        // 前日比に応じて背景色を変更（米ドル/円を除く）
        if (item.name !== '米ドル/円' && item.previous_day_change) {
            const changeValue = parseFloat(String(item.previous_day_change).replace(/,/g, ''));
            if (changeValue > 0) {
                itemDiv.classList.add('card-positive');
            } else if (changeValue < 0) {
                itemDiv.classList.add('card-negative');
            }
        }

        itemDiv.addEventListener('click', () => openPopup(item));

        //const code = item.code || 'Code not found';
        //const heading = document.createElement('h4');
        //heading.textContent = item.name || `Code: ${code}`;
        //itemDiv.appendChild(heading);

        const detailsDiv = document.createElement('div');
        detailsDiv.classList.add('card-details');

        let cardContent = '';
        if (item.name === '米ドル/円') {
            cardContent = `
                <p><strong>Code: ${item.code || 'Code not found'}</strong></p>
                <p><strong>Name:</strong> ${item.name}</p>
                <p><strong>Bid値:</strong> ${item.bid_value || 'N/A'}</p>
                <p><strong>更新日時:</strong> ${item.update_time || 'N/A'}</p>
            `;
        } else {
            const code = item.code || 'Code time not found';
            const name = item.name || 'Name not found';
            const value = item.current_value || item.bid_value || 'N/A';
            const change = item.previous_day_change ? `${item.previous_day_change} (${item.change_rate}%)` : 'N/A';
            const updateTime = item.update_time || 'Update time not found';

            cardContent = `
                <p><strong>Code: ${code}</strong></p>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>現在値:</strong> ${value}</p>
                <p><strong>前日比:</strong> ${change}</p>
                <p><strong>更新日時:</strong> ${updateTime}</p>
            `;
        }

        detailsDiv.innerHTML = cardContent;
        itemDiv.appendChild(detailsDiv);

        targetContainer.appendChild(itemDiv);
    }

    // すべてのデータを取得し、振り分けて表示するメイン関数
    async function fetchAllData() {
        const defaultCodes = ['USDJPY=FX', '^DJI', '998407'];
        // portfolio変数はDOMContentLoadedのスコープで定義されているため、直接アクセス可能
        const portfolioCodes = portfolio.map(stock => stock.code);

        // APIへの問い合わせ用に、重複を排除したコードリストを作成
        const uniqueCodes = new Set([...defaultCodes, ...portfolioCodes]);
        const allCodes = Array.from(uniqueCodes);

        // デフォルト指標のコンテナをクリアし、メッセージを表示
        cardContainer.innerHTML = '';
        cardContainer.textContent = 'デフォルト指標を取得中...';

        // 保有株のコンテナをクリアし、メッセージを表示
        lastSearchedCardContainer.innerHTML = '';
        if (portfolio.length > 0) {
            lastSearchedCardContainer.textContent = '保有株の現在値を取得中...';
        } else {
            lastSearchedCardContainer.textContent = '保有株データはありません。';
        }

        if (allCodes.length === 0) {
            cardContainer.textContent = '表示するデータがありません。';
            return;
        }

        try {
            const response = await fetch(`${WORKER_URL}?codes=${encodeURIComponent(allCodes.join(','))}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`サーバーエラー: ${response.status} ${response.statusText} - ${errorText}`);
            }
            const result = await response.json();
            updateRawDataDisplay(result); // 生データを更新

            if (result.status === 'success' && result.data && result.data.data) {
                cardContainer.innerHTML = ''; // メッセージをクリア
                lastSearchedCardContainer.innerHTML = ''; // メッセージをクリア

                const fetchedDataMap = new Map(result.data.data.map(item => [item.code || (item.name === '米ドル/円' ? 'USDJPY=FX' : null), item]));

                // デフォルト指標を表示
                defaultCodes.forEach(code => {
                    let item = fetchedDataMap.get(code);
                    // .O サフィックスのフォールバック
                    if (!item && fetchedDataMap.has(code + '.O')) {
                        item = fetchedDataMap.get(code + '.O');
                    }
                    if (item) {
                        createAndAppendCard(item, cardContainer);
                    }
                });

                // 保有株一覧を表示（重複を許容）
                portfolio.forEach(stock => {
                    const item = fetchedDataMap.get(stock.code);
                    if (item) {
                        // 保有株情報（取得株数、単価）をAPIからのデータにマージしてポップアップに表示
                        const displayItem = { ...item, ...stock };
                        createAndAppendCard(displayItem, lastSearchedCardContainer);
                    }
                });

            } else {
                cardContainer.textContent = `APIエラー: ${result.message}`;
                lastSearchedCardContainer.textContent = `APIエラー: ${result.message}`;
            }
        } catch (error) {
            cardContainer.textContent = `エラー: ${error.message}`;
            lastSearchedCardContainer.textContent = `エラー: ${error.message}`;
        }
    }

    // カウントダウン表示を更新する関数
    function updateCountdownDisplay() {
        updateCountdownSpan.textContent = `次の更新まで ${countdown} 秒`;
        countdown--;
        if (countdown < 0) {
            countdown = UPDATE_INTERVAL_SECONDS;
        }
    }

    // 自動更新を開始する関数
    function startAutoUpdate() {
        stopAutoUpdate(); // 既存のタイマーをクリア
        countdown = UPDATE_INTERVAL_SECONDS; // カウントダウンをリセット
        updateCountdownDisplay(); // 即座に表示を更新
        updateIntervalId = setInterval(() => {
            if (countdown === 0) {
                fetchAllData();
            }
            updateCountdownDisplay();
        }, 1000);
    }

    // 自動更新を停止する関数
    function stopAutoUpdate() {
        clearInterval(updateIntervalId);
        updateCountdownSpan.textContent = ''; // カウントダウン表示をクリア
    }

    // 個別コード検索のイベントリスナー
    document.getElementById('code-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const code = document.getElementById('code-input').value;
        localStorage.setItem('lastSearchedCode', code); // ローカルストレージに保存

        // 新しい表示エリアに検索中メッセージを表示
        lastSearchedCardContainer.innerHTML = '';
        lastSearchedCardContainer.textContent = `'${code}'を検索中...`;

        try {
            const response = await fetch(`${WORKER_URL}?codes=${encodeURIComponent(code)}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`サーバーエラー: ${response.status} ${response.statusText} - ${errorText}`);
            }
            const result = await response.json();
            updateRawDataDisplay(result); // 生データを更新

            if (result.status === 'success' && result.data && result.data.data) {
                lastSearchedCardContainer.innerHTML = ''; // 検索中メッセージをクリア
                result.data.data.forEach(item => {
                    createAndAppendCard(item, lastSearchedCardContainer);
                });
            } else {
                lastSearchedCardContainer.textContent = `APIエラー: ${result.message}`;
            }
        } catch (error) {
            lastSearchedCardContainer.textContent = `エラー: ${error.message}`;
        }
    });

    // 保有株データをテーブルにレンダリングする関数
    function renderPortfolio() {
        portfolioTableBody.innerHTML = '';
        portfolio.forEach(stock => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${stock.code}</td>
                <td>${stock.shares}</td>
                <td>${stock.price}</td>
                <td>
                    <button class="edit-btn" data-id="${stock.id}">編集</button>
                    <button class="delete-btn" data-id="${stock.id}">削除</button>
                </td>
            `;
            portfolioTableBody.appendChild(row);
        });
    }

    // フォーム送信時の処理
    portfolioForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const id = portfolioIdInput.value;
        const code = portfolioCodeInput.value;
        const shares = portfolioSharesInput.value;
        const price = portfolioPriceInput.value;

        if (id) {
            // 編集の場合
            const stock = portfolio.find(s => s.id == id);
            stock.code = code;
            stock.shares = shares;
            stock.price = price;
        } else {
            // 新規追加の場合
            portfolio.push({ id: Date.now(), code, shares, price });
        }

        localStorage.setItem('portfolio', JSON.stringify(portfolio));
        renderPortfolio();
        portfolioForm.reset();
        portfolioIdInput.value = ''; // hidden inputもクリア
        fetchAllData(); // 保有株が変更されたらデータを再取得
    });

    // テーブル内のボタンクリック処理
    portfolioTableBody.addEventListener('click', (event) => {
        const target = event.target;
        const id = target.dataset.id;

        if (target.classList.contains('delete-btn')) {
            portfolio = portfolio.filter(s => s.id != id);
            localStorage.setItem('portfolio', JSON.stringify(portfolio));
            renderPortfolio();
            fetchAllData(); // 保有株が変更されたらデータを再取得
        }

        if (target.classList.contains('edit-btn')) {
            const stock = portfolio.find(s => s.id == id);
            portfolioIdInput.value = stock.id;
            portfolioCodeInput.value = stock.code;
            portfolioSharesInput.value = stock.shares;
            portfolioPriceInput.value = stock.price;
        }
    });

    // ページ読み込み時の初期処理
    fetchAllData(); // 初回データ取得
    renderPortfolio(); // 保有株テーブルの初期表示

    // 自動更新チェックボックスのイベントリスナー
    autoUpdateCheckbox.addEventListener('change', () => {
        if (autoUpdateCheckbox.checked) {
            startAutoUpdate();
        } else {
            stopAutoUpdate();
        }
    });

    // ポップアップを閉じるイベントリスナー
    popupCloseBtn.addEventListener('click', closePopup);
    popupOverlay.addEventListener('click', closePopup);
});